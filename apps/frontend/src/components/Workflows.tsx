'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"

// Workflow data
const workflows = [
  { id: 1, name: "Automated Invoicing", status: "Active" },
  { id: 2, name: "Client Onboarding Flow", status: "Draft" },
  { id: 3, name: "Weekly Report Generation", status: "Scheduled" },
  { id: 4, name: "Payment Reconciliation", status: "Completed" },
]

export default function Workflows() {
  return (
    <Card className="h-fit font-generalSans bg-bg-light">
      <CardHeader>
        <CardTitle className="text-2xl -mb-4 -mt-2 text-text">Workflows</CardTitle>
      </CardHeader>
      <CardContent>
        <Carousel
          opts={{
            align: "start",
          }}
          orientation="vertical"
          className="w-full max-w-xs"
        >
          <CarouselContent className="-mt-1 h-[200px]">
            {workflows.map((workflow) => (
              <CarouselItem key={workflow.id} className="pt-1 md:basis-1/2">
                <div className="p-1">
                  <Card className="group bg-primary hover:bg-border-muted rounded-md transition-colors duration-100">
                    <CardContent className="flex flex-col items-center justify-center p-4 text-center">
                      <h4 className="font-semibold text-text text-md group-hover:text-white">
                        {workflow.name}
                      </h4>
                      <p className="text-xs text-text-muted group-hover:text-muted">
                        {workflow.status}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
      </CardContent>
    </Card>
  )
}
