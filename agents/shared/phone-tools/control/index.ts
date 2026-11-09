import type { PhoneTool } from "../tool"
import { appTools } from "./app-tools"
import { pceTools } from "./pce-tools"
import { screenTools } from "./screen-tools"

// Phone control (full channel only). This folder is left out of the lite
// and play agent configs, so those builds carry no PCE or accessibility
// tool code at all.
export const controlTools: PhoneTool[] = [...pceTools, ...screenTools, ...appTools]
