"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Sidebar } from "@/components/workspace/sidebar"
import { CenterPanel } from "@/components/workspace/center-panel"
import { RightPanel } from "@/components/workspace/right-panel"
import { BottomRail } from "@/components/workspace/bottom-rail"
import { TooltipProvider } from "@/components/ui/tooltip"
import { WorkspaceProvider } from "@/components/workspace/workspace-provider"

export function WorkspaceShell() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false)
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = React.useState(false)
  const [isBottomRailCollapsed, setIsBottomRailCollapsed] = React.useState(false)

  return (
    <WorkspaceProvider>
      <TooltipProvider delayDuration={0}>
        <div className="h-screen w-full bg-[#0a0a0c] text-zinc-100 overflow-hidden flex flex-col">
          <div className="flex-1 flex overflow-hidden">
            
            {/* Left Sidebar */}
            <div 
              className={cn(
                "bg-[#0a0a0c] border-r border-zinc-800 transition-all duration-300 ease-in-out flex flex-col", 
                isSidebarCollapsed ? "w-[50px]" : "w-[290px]"
              )}
            >
              <Sidebar />
            </div>
            
            {/* Center & Bottom Group */}
            <div className="flex-1 flex flex-col min-w-0">
              <div className="flex-1 flex flex-col min-h-0 relative">
                <CenterPanel />
              </div>
              
              <div className={cn(
                "border-t border-zinc-800 transition-all duration-300 ease-in-out flex flex-col",
                isBottomRailCollapsed ? "h-[36px]" : "h-[200px]"
              )}>
                <BottomRail />
              </div>
            </div>

            {/* Right Inspector */}
            <div 
              className={cn(
                "border-l border-zinc-800 transition-all duration-300 ease-in-out flex flex-col bg-[#0a0a0c]",
                isRightPanelCollapsed ? "w-[40px]" : "w-[400px] xl:w-[450px]"
              )}
            >
              <RightPanel />
            </div>

          </div>
        </div>
      </TooltipProvider>
    </WorkspaceProvider>
  )
}
