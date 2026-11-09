import { controlTools } from "../../phone-tools/control/index"
import { phonePlugin } from "../mobile/opencode"

// Full-channel phone control. This plugin folder (and phone-tools/control)
// is left out of the lite/play agent configs, so those builds carry no PCE
// or accessibility tool code.
export default phonePlugin("phonecando.automation", controlTools)
