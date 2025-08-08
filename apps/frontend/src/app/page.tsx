import { AppSidebar } from "@/components/AppSidebar"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import LoginButton from "@/components/LoginButton";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card" 
import TaskList from "@/components/TaskList";

//MOCK DATA
// Define workflow data
const workflows = [
  { id: 1, name: "Automated Invoicing", status: "Active" },
  { id: 2, name: "Client Onboarding Flow",  status: "Draft" },
  { id: 3, name: "Weekly Report Generation", status: "Scheduled" },
  { id: 4, name: "Payment Reconciliation", status: "Completed" },
];

export default function Home() {
  
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b justify-between">
          {/* Left section (Sidebar trigger) */}
  <div className="flex items-center gap-2 ml-2">
    <SidebarTrigger className="bg-text" />
    <Breadcrumb>
  <BreadcrumbList>
    <BreadcrumbItem className="hidden md:block text-text font-semibold font-generalSans text-lg">
      <BreadcrumbLink href="/" className="hover:text-text-muted">
        Dashboard
      </BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator className="hidden md:block text-muted-foreground" />
    <BreadcrumbItem>
      <BreadcrumbPage className="text-text-muted font-semibold font-generalSans text-lg">Overview</BreadcrumbPage>
    </BreadcrumbItem>
  </BreadcrumbList>
</Breadcrumb>

  </div>

  
  <div className="flex items-center gap-2 mr-2">
    <LoginButton />
    <Separator orientation="vertical" className="h-4" />
  </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 ">
          {/*Workflows */}
          <Card className="h-fit font-generalSans bg-gray-300">
              <CardHeader>
                <CardTitle className="text-2xl -mb-4 -mt-2">Workflows</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 ">
                {workflows.map((workflow) => (
                  <Card
  key={workflow.id}
  className="group p-4 flex flex-col items-center text-center bg-primary hover:bg-dHighlight transition-colors duration-100"
>
  <h4 className="font-semibold text-text text-md group-hover:text-white">
    {workflow.name}
  </h4>
  <p className="text-xs text-text-muted group-hover:text-muted">
    {workflow.status}
  </p>
</Card>

                ))}
              </CardContent>
            </Card>

          {/* Task List */}
          <TaskList />
          
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
