"use client"

import { useCallback, useMemo, type CSSProperties } from "react"
import { useRouter } from "next/navigation"
import { Crown } from "lucide-react"
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeProps,
  Position,
  Panel,
  MarkerType,
} from "@xyflow/react"
import dagre from "dagre"
import "@xyflow/react/dist/style.css"
import { AgentGlyph, PRIMARY, ToolBrandIcon } from "@/app/(sidebar)/agents_and_tools/agentToolVisuals"

export interface Tool {
  name: string
  description?: string
}

export interface Agent {
  identifier: string
  name: string
  type?: string
  parent?: string
  tools: Tool[]
}

const formatName = (name: string) =>
  name.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())

function AgentNode({ data, selected }: NodeProps) {
  const router = useRouter()
  const label = String(data.label || "")

  return (
    <div
      className={`
        flex min-w-[200px] cursor-pointer items-center gap-3 rounded-2xl border-2 bg-white px-4 py-3 shadow-sm transition-all dark:bg-slate-900
        border-slate-200 dark:border-slate-600 hover:border-[#0056D2]/40
        ${selected ? "border-[#0056D2] shadow-lg shadow-[#0056D2]/15" : ""}
      `}
      onClick={() => data.identifier && router.push(`/agents_and_tools/${data.identifier}`)}
    >
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-2" />
      <AgentGlyph agentName={String(data.identifier ?? label)} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">{formatName(label)}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{(data.toolCount as number) ?? 0} tools</p>
      </div>
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-2" />
    </div>
  )
}

function ToolNode({ data, selected }: NodeProps) {
  const label = String(data.label || "")
  const agentName = data.agentName != null ? String(data.agentName) : undefined

  return (
    <div
      className={`
        flex min-w-[168px] cursor-default items-center gap-2 rounded-xl border bg-slate-50/90 px-3 py-2 transition-all dark:bg-slate-800/80
        border-slate-200/80 dark:border-slate-600/80 hover:border-slate-300 dark:hover:border-slate-500
        ${selected ? "border-[#0056D2]/50" : ""}
      `}
    >
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-2" />
      <ToolBrandIcon toolName={label} sourceAgentName={agentName} size={32} />
      <p className="truncate text-xs font-medium text-slate-800 dark:text-slate-100">{formatName(label)}</p>
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-2 opacity-0" />
    </div>
  )
}

function SuperAgentNode({ data: _data, selected }: NodeProps) {
  return (
    <div
      className={`
        flex min-w-[220px] cursor-default items-center gap-3 rounded-2xl border-2 bg-gradient-to-br px-5 py-3 shadow-md
        from-blue-50 to-indigo-50/80 border-[#0056D2]/30 dark:from-slate-800 dark:to-slate-900 dark:border-[#0056D2]/40
        ${selected ? "shadow-lg shadow-[#0056D2]/20" : ""}
      `}
    >
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-2 opacity-0" />
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-md ring-2 ring-white/50 dark:ring-slate-900/50"
        style={{ background: `linear-gradient(135deg, ${PRIMARY}, #003d9e)` }}
      >
        <Crown className="h-5 w-5 text-white drop-shadow-sm" strokeWidth={1.75} />
      </div>
      <div>
        <p className="text-base font-bold text-slate-900 dark:text-slate-50">Super Agent</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">Root orchestrator</p>
      </div>
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-2" />
    </div>
  )
}

const nodeTypes = {
  agent: AgentNode,
  tool: ToolNode,
  superAgent: SuperAgentNode,
}

const NODE_WIDTH = 220
const NODE_HEIGHT = 64
const TOOL_NODE_WIDTH = 184
const TOOL_NODE_HEIGHT = 48

function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  direction: "TB" | "LR" = "TB"
) {
  const isHorizontal = direction === "LR"
  const dagreGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}))
  dagreGraph.setGraph({ rankdir: direction, ranksep: 220, nodesep: 140 })

  nodes.forEach((node) => {
    const isTool = node.type === "tool"
    const w = isTool ? TOOL_NODE_WIDTH : NODE_WIDTH
    const h = isTool ? TOOL_NODE_HEIGHT : NODE_HEIGHT
    dagreGraph.setNode(node.id, { width: w, height: h })
  })

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target)
  })

  dagre.layout(dagreGraph)

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id)
    const isTool = node.type === "tool"
    const w = isTool ? TOOL_NODE_WIDTH : NODE_WIDTH
    const h = isTool ? TOOL_NODE_HEIGHT : NODE_HEIGHT
    return {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      position: {
        x: nodeWithPosition.x - w / 2,
        y: nodeWithPosition.y - h / 2,
      },
    }
  })

  return { nodes: layoutedNodes, edges }
}

function buildGraphFromAgents(agents: Agent[]): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []
  const agentMap = new Map<string, Agent>()
  agents.forEach((a) => agentMap.set(a.identifier, a))

  // Add super_agent as root (virtual node)
  const hasSuperAgentParent = agents.some((a) => a.parent === "super_agent")
  if (hasSuperAgentParent) {
    nodes.push({
      id: "super_agent",
      type: "superAgent",
      data: { label: "Super Agent" },
      position: { x: 0, y: 0 },
    })
  }

  // Add agent nodes and edges to parents
  agents.forEach((agent) => {
    const parentId = agent.parent || "super_agent"
    const parentExists =
      parentId === "super_agent" ? hasSuperAgentParent : agentMap.has(parentId)

    nodes.push({
      id: agent.identifier,
      type: "agent",
      data: {
        label: agent.name,
        identifier: agent.identifier,
        toolCount: agent.tools.length,
      },
      position: { x: 0, y: 0 },
    })

    if (parentExists) {
      edges.push({
        id: `${parentId}-${agent.identifier}`,
        source: parentId,
        target: agent.identifier,
        type: "smoothstep",
        animated: true,
        style: { stroke: PRIMARY, strokeWidth: 2.5, strokeOpacity: 1 },
        markerEnd: { type: MarkerType.ArrowClosed, color: PRIMARY },
      })
    }
  })

  // Add tool nodes and edges to their agents
  agents.forEach((agent) => {
    agent.tools.forEach((tool, idx) => {
      const toolId = `${agent.identifier}-tool-${tool.name}`
      nodes.push({
        id: toolId,
        type: "tool",
        data: { label: tool.name, agentName: agent.identifier },
        position: { x: 0, y: 0 },
      })
      edges.push({
        id: `${agent.identifier}-${tool.name}`,
        source: agent.identifier,
        target: toolId,
        type: "smoothstep",
        style: { stroke: PRIMARY, strokeWidth: 2, strokeOpacity: 0.45 },
        markerEnd: { type: MarkerType.ArrowClosed, color: PRIMARY },
      })
    })
  })

  return { nodes, edges }
}

interface AgentsGraphViewProps {
  agents: Agent[]
  fullPage?: boolean
}

export function AgentsGraphView({ agents, fullPage = true }: AgentsGraphViewProps) {
  const { initialNodes, initialEdges } = useMemo(() => {
    const { nodes, edges } = buildGraphFromAgents(agents)
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      nodes,
      edges,
      "TB"
    )
    return { initialNodes: layoutedNodes, initialEdges: layoutedEdges }
  }, [agents])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  const onLayout = useCallback(
    (direction: "TB" | "LR") => {
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        nodes,
        edges,
        direction
      )
      setNodes([...layoutedNodes])
      setEdges([...layoutedEdges])
    },
    [nodes, edges, setNodes, setEdges]
  )

  return (
    <div
      className={`w-full overflow-hidden agents-graph-view bg-background ${
        fullPage ? "h-full min-h-0" : "h-[600px] rounded-lg border border-border"
      }`}
      style={
        {
          // Override React Flow dark theme edge colors (default #3e3e3e is invisible on dark bg)
          "--xy-edge-stroke-default": "#0056D2",
          "--xy-edge-stroke-width-default": 2,
          "--xy-edge-stroke-selected-default": "#003d9e",
        } as CSSProperties
      }
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={{
          type: "smoothstep",
          style: { stroke: PRIMARY, strokeWidth: 2, strokeOpacity: 0.9 },
          markerEnd: { type: MarkerType.ArrowClosed, color: PRIMARY },
        }}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
        className="bg-transparent"
      >
        <Background color="hsl(var(--border))" gap={16} size={1} />
        <Controls
          className="!bg-bg !border-border !shadow-none [&>button]:!bg-bg [&>button]:!border-border [&>button]:!text-foreground [&>button:hover]:!bg-muted"
          showInteractive={false}
        />
        <Panel position="top-right" className="flex gap-2">
          <button
            type="button"
            onClick={() => onLayout("TB")}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Vertical
          </button>
          <button
            type="button"
            onClick={() => onLayout("LR")}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Horizontal
          </button>
        </Panel>
      </ReactFlow>
    </div>
  )
}
