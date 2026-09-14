from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class Organization(BaseModel):
    id: str = Field(..., description="Organization unique identifier")
    name: str = Field(..., description="Organization name")
    description: Optional[str] = Field(None, description="Organization description")
    employee_count: Optional[int] = Field(None, description="Number of employees")
    ecommerce_domain: Optional[str] = Field(None, description="E-commerce domain")
    industry: Optional[str] = Field(None, description="Industry sector")
    company_size: Optional[str] = Field(None, description="Company size category")
    website: Optional[str] = Field(None, description="Organization website")
    country: Optional[str] = Field(None, description="Country")
    city: Optional[str] = Field(None, description="City")
    address: Optional[str] = Field(None, description="Street address")
    phone_number: Optional[str] = Field(None, description="Contact phone number")
    is_active: bool = Field(
        default=True, description="Whether the organization is active"
    )
    subscription_plan: Optional[str] = Field(
        None, description="Current subscription plan"
    )
    created_at: Optional[datetime] = Field(None, description="Creation timestamp")
    updated_at: Optional[datetime] = Field(None, description="Last update timestamp")
    user_role: Optional[str] = Field(
        None, description="Current user's role in the organization"
    )
