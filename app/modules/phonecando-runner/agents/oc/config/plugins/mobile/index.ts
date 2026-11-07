import { basicTools } from "../../phone-tools/basic"
import { phonePlugin } from "./opencode"

// The basic phone tools every channel gets (ping, battery, notify, share,
// open, clipboard); phone control is the full-only automation plugin.
export default phonePlugin("phonecando.mobile", basicTools)
