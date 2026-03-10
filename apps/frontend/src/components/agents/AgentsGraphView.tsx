'use client'

import { useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
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
} from '@xyflow/react'
import dagre from 'dagre'
import '@xyflow/react/dist/style.css'

export interface Tool {
  name: string
  description: string
}

export interface Agent {
  identifier: string
  name: string
  type?: string
  parent?: string
  tools: Tool[]
}

const formatName = (name: string) =>
  name.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())

const AGENT_COLORS = [
  'from-blue-500 to-cyan-500',
  'from-purple-500 to-pink-500',
  'from-green-500 to-emerald-500',
  'from-orange-500 to-amber-500',
  'from-red-500 to-rose-500',
  'from-indigo-500 to-blue-500',
]

const TOOL_COLORS = [
  'bg-blue-500',
  'bg-purple-500',
  'bg-green-500',
  'bg-orange-500',
  'bg-cyan-500',
  'bg-pink-500',
]

function getAgentColor(name: string) {
  const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return AGENT_COLORS[index % AGENT_COLORS.length]
}

function getToolColor(name: string) {
  const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return TOOL_COLORS[index % TOOL_COLORS.length]
}

function AgentNode({ data, selected }: NodeProps) {
  const router = useRouter()
  const label = String(data.label || '')
  const formattedName = formatName(label)
  const firstLetter = formattedName[0]?.toUpperCase() || 'A'
  const gradientColor = getAgentColor(label)

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-2 rounded-lg border-2 min-w-[180px] cursor-pointer
        bg-bg border-border hover:border-primary/50 transition-all
        ${selected ? 'border-primary shadow-lg shadow-primary/20' : ''}
      `}
      onClick={() => data.identifier && router.push(`/agents_and_tools/${data.identifier}`)}
    >
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !border-2" />
      <div
        className={`h-10 w-10 rounded-full bg-gradient-to-br ${gradientColor} flex items-center justify-center text-white font-bold text-sm shrink-0`}
      >
        {firstLetter}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">{formattedName}</p>
        <p className="text-xs text-muted-foreground">{(data.toolCount as number) ?? 0} tools</p>
      </div>
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !border-2" />
    </div>
  )
}

function ToolNode({ data, selected }: NodeProps) {
  const label = String(data.label || '')
  const firstLetter = (label || 'T')[0].toUpperCase()
  const toolColor = getToolColor(label)

  return (
    <div
      className={`
        flex items-center gap-2 px-3 py-2 rounded-lg border min-w-[140px] cursor-default
        bg-bg-light/50 border-border/70 hover:border-muted-foreground/30 transition-all
        ${selected ? 'border-primary/50' : ''}
      `}
    >
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !border-2" />
      <div
        className={`h-8 w-8 rounded-full ${toolColor} flex items-center justify-center text-white font-bold text-xs shrink-0`}
      >
        {firstLetter}
      </div>
      <p className="font-medium text-xs truncate">{formatName(label)}</p>
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !border-2 opacity-0" />
    </div>
  )
}

function SuperAgentNode({ data, selected }: NodeProps) {
  return (
    <div
      className={`
        flex items-center gap-3 px-5 py-3 rounded-xl border-2 min-w-[200px] cursor-default
        bg-gradient-to-br from-primary/20 to-primary/5 border-primary/50
        ${selected ? 'border-primary shadow-lg shadow-primary/30' : ''}
      `}
    >
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !border-2 opacity-0" />
      <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground font-bold text-lg shrink-0">
        S
      </div>
      <div>
        <p className="font-bold text-base">Super Agent</p>
        <p className="text-xs text-muted-foreground">Root orchestrator</p>
      </div>
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !border-2" />
    </div>
  )
}

const nodeTypes = {
  agent: AgentNode,
  tool: ToolNode,
  superAgent: SuperAgentNode,
}

const NODE_WIDTH = 200
const NODE_HEIGHT = 56
const TOOL_NODE_WIDTH = 160
const TOOL_NODE_HEIGHT = 44

function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'TB'
) {
  const isHorizontal = direction === 'LR'
  const dagreGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}))
  dagreGraph.setGraph({ rankdir: direction, ranksep: 220, nodesep: 140 })

  nodes.forEach((node) => {
    const isTool = node.type === 'tool'
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
    const isTool = node.type === 'tool'
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
  const hasSuperAgentParent = agents.some((a) => a.parent === 'super_agent')
  if (hasSuperAgentParent) {
    nodes.push({
      id: 'super_agent',
      type: 'superAgent',
      data: { label: 'Super Agent' },
      position: { x: 0, y: 0 },
    })
  }

  // Add agent nodes and edges to parents
  agents.forEach((agent) => {
    const parentId = agent.parent || 'super_agent'
    const parentExists =
      parentId === 'super_agent' ? hasSuperAgentParent : agentMap.has(parentId)

    nodes.push({
      id: agent.identifier,
      type: 'agent',
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
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#22c55e', strokeWidth: 3, strokeOpacity: 1 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#22c55e' },
      })
    }
  })

  // Add tool nodes and edges to their agents
  agents.forEach((agent) => {
    agent.tools.forEach((tool, idx) => {
      const toolId = `${agent.identifier}-tool-${tool.name}`
      nodes.push({
        id: toolId,
        type: 'tool',
        data: { label: tool.name },
        position: { x: 0, y: 0 },
      })
      edges.push({
        id: `${agent.identifier}-${tool.name}`,
        source: agent.identifier,
        target: toolId,
        type: 'smoothstep',
        style: { stroke: '#94a3b8', strokeWidth: 2.5, strokeOpacity: 1 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
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
      'TB'
    )
    return { initialNodes: layoutedNodes, initialEdges: layoutedEdges }
  }, [agents])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  const onLayout = useCallback(
    (direction: 'TB' | 'LR') => {
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
        fullPage ? 'h-full min-h-0' : 'h-[600px] rounded-lg border border-border'
      }`}
      style={
        {
          // Override React Flow dark theme edge colors (default #3e3e3e is invisible on dark bg)
          '--xy-edge-stroke-default': '#22c55e',
          '--xy-edge-stroke-width-default': 2.5,
          '--xy-edge-stroke-selected-default': '#4ade80',
        } as React.CSSProperties
      }
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={{
          type: 'smoothstep',
          style: { stroke: '#22c55e', strokeWidth: 2.5, strokeOpacity: 1 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#22c55e' },
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
            onClick={() => onLayout('TB')}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-bg-light border border-border hover:bg-muted transition-colors"
          >
            Vertical
          </button>
          <button
            onClick={() => onLayout('LR')}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-bg-light border border-border hover:bg-muted transition-colors"
          >
            Horizontal
          </button>
        </Panel>
      </ReactFlow>
    </div>
  )
}
