package policy

import (
	"backend/database"
	"backend/models"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type PlanConfig struct {
	Code            string
	CreditsPerCycle int64                  `json:"credits_per_cycle"`
	Rules           map[string]interface{} `json:"rules"`
}

type planFileConfig struct {
	CreditsPerCycle int64                  `json:"credits_per_cycle"`
	Rules           map[string]interface{} `json:"rules"`
}

type Service struct {
	db             *database.DB
	defaultCycle   int
	starterPlanKey string
	plans          map[string]PlanConfig
}

func NewService(db *database.DB) *Service {
	s := &Service{
		db:             db,
		defaultCycle:   getenvInt("CREDITS_DEFAULT_CYCLE_DAYS", 30),
		starterPlanKey: "starter",
		plans:          loadPlansConfig("services/policy/plan_definitions.json"),
	}
	if _, ok := s.plans[s.starterPlanKey]; !ok {
		s.plans[s.starterPlanKey] = PlanConfig{Code: "starter", CreditsPerCycle: 1000, Rules: map[string]interface{}{}}
	}
	return s
}

func loadPlansConfig(path string) map[string]PlanConfig {
	defaults := map[string]PlanConfig{
		"starter":  {Code: "starter", CreditsPerCycle: 1000, Rules: map[string]interface{}{}},
		"pro":      {Code: "pro", CreditsPerCycle: 5000, Rules: map[string]interface{}{}},
		"business": {Code: "business", CreditsPerCycle: 20000, Rules: map[string]interface{}{}},
	}

	content, err := os.ReadFile(path)
	if err != nil {
		return defaults
	}
	parsed := map[string]planFileConfig{}
	if err := json.Unmarshal(content, &parsed); err != nil {
		return defaults
	}
	out := map[string]PlanConfig{}
	for code, cfg := range parsed {
		out[code] = PlanConfig{Code: code, CreditsPerCycle: cfg.CreditsPerCycle, Rules: cfg.Rules}
	}
	if len(out) == 0 {
		return defaults
	}
	return out
}

func getenvInt(key string, fallback int) int {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return fallback
	}
	i, err := strconv.Atoi(v)
	if err != nil || i <= 0 {
		return fallback
	}
	return i
}

func (s *Service) EnsureSchemaAndSeed() error {
	createAccounts := `
CREATE TABLE IF NOT EXISTS credit_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_type VARCHAR(20) NOT NULL CHECK (owner_type IN ('user', 'organization')),
    owner_id UUID NOT NULL,
    plan_code VARCHAR(32) NOT NULL DEFAULT 'starter',
    total_credits BIGINT NOT NULL DEFAULT 0 CHECK (total_credits >= 0),
    credits_consumed BIGINT NOT NULL DEFAULT 0 CHECK (credits_consumed >= 0),
    cycle_start TIMESTAMP NOT NULL DEFAULT now(),
    cycle_end TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE(owner_type, owner_id),
    CHECK (credits_consumed <= total_credits)
);`
	if err := s.db.Exec(createAccounts).Error; err != nil {
		return err
	}

	createRecords := `
CREATE TABLE IF NOT EXISTS credit_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    credit_account_id UUID NOT NULL REFERENCES credit_accounts(id) ON DELETE CASCADE,
    record_type VARCHAR(32) NOT NULL CHECK (record_type IN ('consume', 'plan_change', 'cycle_reset', 'adjustment', 'grant_system')),
    credits_delta BIGINT NOT NULL,
    total_credits_after BIGINT NOT NULL,
    credits_consumed_after BIGINT NOT NULL,
    action_key VARCHAR(128),
    reference_id VARCHAR(255),
    actor_user_id UUID NULL,
    metadata_json JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    CHECK (total_credits_after >= 0),
    CHECK (credits_consumed_after >= 0),
    CHECK (credits_consumed_after <= total_credits_after)
);`
	if err := s.db.Exec(createRecords).Error; err != nil {
		return err
	}

	if err := s.db.Exec(`CREATE INDEX IF NOT EXISTS idx_credit_records_account_created_at ON credit_records(credit_account_id, created_at DESC);`).Error; err != nil {
		return err
	}
	if err := s.db.Exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_records_idempotency ON credit_records(credit_account_id, record_type, reference_id) WHERE reference_id IS NOT NULL;`).Error; err != nil {
		return err
	}

	// Compatibility for previous schema versions.
	if err := s.db.Exec(`ALTER TABLE credit_accounts ADD COLUMN IF NOT EXISTS plan_code VARCHAR(32);`).Error; err != nil {
		return err
	}
	if err := s.db.Exec(`UPDATE credit_accounts SET plan_code = 'starter' WHERE plan_code IS NULL OR plan_code = '';`).Error; err != nil {
		return err
	}
	if err := s.db.Exec(`ALTER TABLE credit_accounts ALTER COLUMN plan_code SET DEFAULT 'starter';`).Error; err != nil {
		return err
	}
	if err := s.db.Exec(`ALTER TABLE credit_accounts ALTER COLUMN plan_code SET NOT NULL;`).Error; err != nil {
		return err
	}
	if err := s.db.Exec(`ALTER TABLE credit_accounts DROP CONSTRAINT IF EXISTS credit_accounts_plan_id_fkey;`).Error; err != nil {
		return err
	}
	if err := s.db.Exec(`ALTER TABLE credit_accounts ALTER COLUMN plan_id DROP NOT NULL;`).Error; err != nil {
		// ignore if column absent
	}

	return nil
}

func (s *Service) AuthorizeAndMaybeConsume(input AuthorizeInput) (*AuthorizeResult, error) {
	if input.UserID == uuid.Nil || input.ActionKey == "" {
		return nil, ErrInvalidInput
	}

	account, plan, orgRole, err := s.resolveScopeAndPlan(input.UserID, input.OrganizationID)
	if err != nil {
		return nil, err
	}

	rules := plan.Rules
	if err := checkFeature(rules, input.ActionKey); err != nil {
		return nil, err
	}
	if err := checkModel(rules, input.Model); err != nil {
		return nil, err
	}
	if err := checkTools(rules, input.Tools); err != nil {
		return nil, err
	}
	if err := checkActionLimits(rules, input.ActionKey, input); err != nil {
		return nil, err
	}

	if account.OwnerType == "organization" {
		if plan.Code == "business" {
			if !isRBACAllowed(input.EndpointRole, orgRole) {
				return nil, ErrRBACDenied
			}
		} else if orgRole == "" {
			return nil, ErrOrgMembershipRequired
		}
	}

	cost := int64(0)
	if input.RequireBillable {
		cost = computeCost(rules, input.ActionKey, input.Model, input.Tools)
		if cost < 0 {
			cost = 0
		}
	}

	result := &AuthorizeResult{
		Allowed:          true,
		Decision:         "allowed",
		OwnerType:        account.OwnerType,
		OwnerID:          account.OwnerID,
		PlanCode:         plan.Code,
		Cost:             cost,
		TotalCredits:     account.TotalCredits,
		CreditsConsumed:  account.CreditsConsumed,
		AvailableCredits: account.AvailableCredits(),
	}

	if !input.RequireBillable || cost == 0 {
		return result, nil
	}

	updated, err := s.consumeCredits(account.ID, input.UserID, input.ActionKey, input.ReferenceID, cost, input.RequestMeta)
	if err != nil {
		return nil, err
	}

	result.TotalCredits = updated.TotalCredits
	result.CreditsConsumed = updated.CreditsConsumed
	result.AvailableCredits = updated.AvailableCredits()
	result.Metadata = map[string]interface{}{"reference_id": input.ReferenceID}
	return result, nil
}

func (s *Service) GetOverview(userID uuid.UUID, orgID *uuid.UUID) (*models.CreditAccount, *PlanConfig, error) {
	account, plan, _, err := s.resolveScopeAndPlan(userID, orgID)
	if err != nil {
		return nil, nil, err
	}
	return account, plan, nil
}

func (s *Service) GetEntitlements(userID uuid.UUID, orgID *uuid.UUID) (map[string]interface{}, *PlanConfig, error) {
	_, plan, _, err := s.resolveScopeAndPlan(userID, orgID)
	if err != nil {
		return nil, nil, err
	}
	return plan.Rules, plan, nil
}

func (s *Service) ListRecords(userID uuid.UUID, orgID *uuid.UUID, page int, pageSize int) ([]models.CreditRecord, int64, error) {
	account, _, _, err := s.resolveScopeAndPlan(userID, orgID)
	if err != nil {
		return nil, 0, err
	}
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}

	var total int64
	if err := s.db.Model(&models.CreditRecord{}).Where("credit_account_id = ?", account.ID).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var records []models.CreditRecord
	offset := (page - 1) * pageSize
	if err := s.db.Where("credit_account_id = ?", account.ID).Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&records).Error; err != nil {
		return nil, 0, err
	}

	return records, total, nil
}

func (s *Service) SystemCycleReset(ownerType string, ownerID uuid.UUID) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		var account models.CreditAccount
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("owner_type = ? AND owner_id = ?", ownerType, ownerID).First(&account).Error; err != nil {
			return err
		}
		plan, ok := s.planForCode(account.PlanCode)
		if !ok {
			plan, _ = s.planForCode(s.starterPlanKey)
		}

		account.TotalCredits = plan.CreditsPerCycle
		account.CreditsConsumed = 0
		account.CycleStart = time.Now().UTC()
		account.CycleEnd = account.CycleStart.AddDate(0, 0, s.defaultCycle)
		if err := tx.Save(&account).Error; err != nil {
			return err
		}
		meta := map[string]interface{}{"plan_code": plan.Code}
		return s.insertRecord(tx, account.ID, "cycle_reset", 0, account.TotalCredits, account.CreditsConsumed, "cycle.reset", nil, nil, meta)
	})
}

func (s *Service) SystemPlanChange(ownerType string, ownerID uuid.UUID, planCode string) error {
	plan, ok := s.planForCode(planCode)
	if !ok {
		return ErrInvalidInput
	}
	return s.db.Transaction(func(tx *gorm.DB) error {
		var account models.CreditAccount
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("owner_type = ? AND owner_id = ?", ownerType, ownerID).First(&account).Error; err != nil {
			return err
		}
		oldCode := account.PlanCode
		account.PlanCode = plan.Code
		if err := tx.Save(&account).Error; err != nil {
			return err
		}
		ref := fmt.Sprintf("plan:%s:%s", ownerType, ownerID.String())
		meta := map[string]interface{}{"old_plan_code": oldCode, "new_plan_code": plan.Code}
		return s.insertRecord(tx, account.ID, "plan_change", 0, account.TotalCredits, account.CreditsConsumed, "plan.change", &ref, nil, meta)
	})
}

func (s *Service) SystemAdjustment(ownerType string, ownerID uuid.UUID, delta int64, reason string, referenceID string) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		var account models.CreditAccount
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("owner_type = ? AND owner_id = ?", ownerType, ownerID).First(&account).Error; err != nil {
			return err
		}
		if delta >= 0 {
			account.TotalCredits += delta
		} else {
			newTotal := account.TotalCredits + delta
			if newTotal < account.CreditsConsumed {
				return ErrInsufficientCredits
			}
			account.TotalCredits = newTotal
		}
		if err := tx.Save(&account).Error; err != nil {
			return err
		}
		ref := referenceID
		meta := map[string]interface{}{"reason": reason}
		return s.insertRecord(tx, account.ID, "adjustment", delta, account.TotalCredits, account.CreditsConsumed, "system.adjustment", &ref, nil, meta)
	})
}

func (s *Service) resolveScopeAndPlan(userID uuid.UUID, orgID *uuid.UUID) (*models.CreditAccount, *PlanConfig, string, error) {
	ownerType := "user"
	ownerID := userID
	orgRole := ""

	if orgID != nil {
		var userOrg models.UserOrganization
		err := s.db.Where("user_id = ? AND organization_id = ? AND is_active = true", userID, *orgID).First(&userOrg).Error
		if err != nil {
			return nil, nil, "", ErrOrgMembershipRequired
		}
		ownerType = "organization"
		ownerID = *orgID
		orgRole = userOrg.Role
	}

	var account models.CreditAccount
	err := s.db.Where("owner_type = ? AND owner_id = ?", ownerType, ownerID).First(&account).Error
	if err == nil {
		plan, ok := s.planForCode(account.PlanCode)
		if !ok {
			fallback, _ := s.planForCode(s.starterPlanKey)
			plan = fallback
		}
		return &account, &plan, orgRole, nil
	}
	if err != nil && err != gorm.ErrRecordNotFound {
		return nil, nil, "", err
	}

	accountPtr, plan, err2 := s.createDefaultAccount(ownerType, ownerID)
	if err2 != nil {
		return nil, nil, "", err2
	}
	return accountPtr, plan, orgRole, nil
}

func (s *Service) createDefaultAccount(ownerType string, ownerID uuid.UUID) (*models.CreditAccount, *PlanConfig, error) {
	plan, _ := s.planForCode(s.starterPlanKey)
	var created models.CreditAccount
	err := s.db.Transaction(func(tx *gorm.DB) error {
		now := time.Now().UTC()
		created = models.CreditAccount{
			OwnerType:       ownerType,
			OwnerID:         ownerID,
			PlanCode:        plan.Code,
			TotalCredits:    plan.CreditsPerCycle,
			CreditsConsumed: 0,
			CycleStart:      now,
			CycleEnd:        now.AddDate(0, 0, s.defaultCycle),
			Status:          "active",
		}
		if err := tx.Create(&created).Error; err != nil {
			if strings.Contains(err.Error(), "duplicate key") {
				return tx.Where("owner_type = ? AND owner_id = ?", ownerType, ownerID).First(&created).Error
			}
			return err
		}
		meta := map[string]interface{}{"owner_type": ownerType, "owner_id": ownerID.String(), "plan_code": plan.Code}
		ref := fmt.Sprintf("bootstrap:%s:%s", ownerType, ownerID)
		return s.insertRecord(tx, created.ID, "grant_system", plan.CreditsPerCycle, created.TotalCredits, created.CreditsConsumed, "system.bootstrap", &ref, nil, meta)
	})
	if err != nil {
		return nil, nil, err
	}
	finalPlan, _ := s.planForCode(created.PlanCode)
	return &created, &finalPlan, nil
}

func (s *Service) planForCode(code string) (PlanConfig, bool) {
	if code == "" {
		code = s.starterPlanKey
	}
	p, ok := s.plans[code]
	return p, ok
}

func (s *Service) consumeCredits(accountID uuid.UUID, actorID uuid.UUID, actionKey, referenceID string, cost int64, metadata map[string]interface{}) (*models.CreditAccount, error) {
	var out models.CreditAccount
	err := s.db.Transaction(func(tx *gorm.DB) error {
		var account models.CreditAccount
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", accountID).First(&account).Error; err != nil {
			return err
		}

		if referenceID != "" {
			var existing models.CreditRecord
			err := tx.Where("credit_account_id = ? AND record_type = ? AND reference_id = ?", accountID, "consume", referenceID).First(&existing).Error
			if err == nil {
				out = account
				return nil
			}
			if err != nil && err != gorm.ErrRecordNotFound {
				return err
			}
		}

		if account.AvailableCredits() < cost {
			return ErrInsufficientCredits
		}
		account.CreditsConsumed += cost
		if err := tx.Save(&account).Error; err != nil {
			return err
		}
		ref := referenceID
		action := actionKey
		actor := actorID
		if err := s.insertRecord(tx, account.ID, "consume", -cost, account.TotalCredits, account.CreditsConsumed, action, &ref, &actor, metadata); err != nil {
			return err
		}
		out = account
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &out, nil
}

func (s *Service) insertRecord(tx *gorm.DB, accountID uuid.UUID, recordType string, delta, totalAfter, consumedAfter int64, actionKey string, referenceID *string, actor *uuid.UUID, metadata map[string]interface{}) error {
	var action *string
	if actionKey != "" {
		action = &actionKey
	}
	payload := metadata
	if payload == nil {
		payload = map[string]interface{}{}
	}
	encoded := map[string]interface{}{}
	if b, err := json.Marshal(payload); err == nil {
		_ = json.Unmarshal(b, &encoded)
	}
	rec := models.CreditRecord{
		CreditAccountID:   accountID,
		RecordType:        recordType,
		CreditsDelta:      delta,
		TotalCreditsAfter: totalAfter,
		CreditsUsedAfter:  consumedAfter,
		ActionKey:         action,
		ReferenceID:       referenceID,
		ActorUserID:       actor,
		MetadataJSON:      models.JSONBMap(encoded),
	}
	return tx.Create(&rec).Error
}

func isRBACAllowed(role EndpointRole, orgRole string) bool {
	switch role {
	case EndpointRoleAdmin:
		return orgRole == "admin"
	case EndpointRoleRun:
		return orgRole == "admin" || orgRole == "member"
	default:
		return orgRole == "admin" || orgRole == "member" || orgRole == "viewer"
	}
}

func checkFeature(rules map[string]interface{}, action string) error {
	features := getMap(rules, "features")
	if len(features) == 0 {
		return nil
	}
	if b, ok := getBool(features, action); ok {
		if !b {
			return ErrFeatureNotAllowed
		}
		return nil
	}
	return ErrFeatureNotAllowed
}

func checkModel(rules map[string]interface{}, model string) error {
	if model == "" {
		return nil
	}
	limits := getMap(rules, "limits")
	allowed := getStringSlice(limits, "allowed_models")
	if len(allowed) == 0 {
		return nil
	}
	if contains(allowed, "*") || contains(allowed, model) {
		return nil
	}
	return ErrModelNotAllowed
}

func checkTools(rules map[string]interface{}, tools []string) error {
	if len(tools) == 0 {
		return nil
	}
	limits := getMap(rules, "limits")
	allowed := getStringSlice(limits, "allowed_tools")
	if len(allowed) == 0 || contains(allowed, "*") {
		return nil
	}
	for _, t := range tools {
		if !contains(allowed, t) {
			return ErrToolNotAllowed
		}
	}
	return nil
}

func checkActionLimits(rules map[string]interface{}, action string, input AuthorizeInput) error {
	limits := getMap(rules, "limits")
	if action == "agent.chat" {
		maxAgents := getInt64(limits, "max_agents_per_chat", -1)
		agentsCount := input.AgentsCount
		if agentsCount <= 0 {
			agentsCount = len(input.Tools)
		}
		if maxAgents >= 0 && int64(agentsCount) > maxAgents {
			return ErrFeatureNotAllowed
		}
	}
	if action == "secrets.write" {
		maxSecrets := getInt64(limits, "max_secrets", -1)
		if maxSecrets >= 0 {
			current := int64(0)
			if input.RequestMeta != nil {
				if v, ok := input.RequestMeta["secret_count"]; ok {
					switch t := v.(type) {
					case int:
						current = int64(t)
					case int64:
						current = t
					case float64:
						current = int64(t)
					}
				}
			}
			if current >= maxSecrets {
				return ErrFeatureNotAllowed
			}
		}
	}
	if action == "workflow.import" {
		maxTemplates := getInt64(limits, "max_workflow_templates", -1)
		if maxTemplates == 0 {
			return ErrFeatureNotAllowed
		}
	}
	return nil
}

func computeCost(rules map[string]interface{}, action, model string, tools []string) int64 {
	costs := getMap(rules, "costs")
	actionCosts := getMap(costs, "action_costs")
	baseMap := getMap(actionCosts, action)
	base := float64(getInt64(baseMap, "base", 0))

	toolCosts := getMap(costs, "tool_costs")
	for _, t := range tools {
		base += float64(getInt64(toolCosts, t, 0))
	}

	mult := 1.0
	modelM := getMap(costs, "model_multipliers")
	if model != "" {
		if v, ok := getFloat(modelM, model); ok {
			mult = v
		} else if v, ok := getFloat(modelM, "*"); ok {
			mult = v
		}
	}
	return int64(math.Ceil(base * mult))
}

func getMap(m map[string]interface{}, key string) map[string]interface{} {
	if m == nil {
		return map[string]interface{}{}
	}
	raw, ok := m[key]
	if !ok || raw == nil {
		return map[string]interface{}{}
	}
	out, ok := raw.(map[string]interface{})
	if ok {
		return out
	}
	return map[string]interface{}{}
}

func getStringSlice(m map[string]interface{}, key string) []string {
	raw, ok := m[key]
	if !ok || raw == nil {
		return nil
	}
	arr, ok := raw.([]interface{})
	if !ok {
		return nil
	}
	out := make([]string, 0, len(arr))
	for _, v := range arr {
		if s, ok := v.(string); ok {
			out = append(out, s)
		}
	}
	return out
}

func getInt64(m map[string]interface{}, key string, fallback int64) int64 {
	raw, ok := m[key]
	if !ok || raw == nil {
		return fallback
	}
	switch v := raw.(type) {
	case float64:
		return int64(v)
	case int64:
		return v
	case int:
		return int64(v)
	default:
		return fallback
	}
}

func getBool(m map[string]interface{}, key string) (bool, bool) {
	raw, ok := m[key]
	if !ok || raw == nil {
		return false, false
	}
	v, ok := raw.(bool)
	return v, ok
}

func getFloat(m map[string]interface{}, key string) (float64, bool) {
	raw, ok := m[key]
	if !ok || raw == nil {
		return 0, false
	}
	switch v := raw.(type) {
	case float64:
		return v, true
	case int:
		return float64(v), true
	case int64:
		return float64(v), true
	default:
		return 0, false
	}
}

func contains(arr []string, target string) bool {
	for _, v := range arr {
		if v == target {
			return true
		}
	}
	return false
}

func (s *Service) StartCycleResetScheduler() {
	ticker := time.NewTicker(24 * time.Hour)
	go func() {
		defer ticker.Stop()
		s.runCycleResetPass()
		for range ticker.C {
			s.runCycleResetPass()
		}
	}()
}

func (s *Service) runCycleResetPass() {
	var accounts []models.CreditAccount
	if err := s.db.Where("cycle_end <= ?", time.Now().UTC()).Find(&accounts).Error; err != nil {
		return
	}
	for _, a := range accounts {
		_ = s.SystemCycleReset(a.OwnerType, a.OwnerID)
	}
}
