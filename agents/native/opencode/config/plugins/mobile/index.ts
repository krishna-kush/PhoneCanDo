import { agentTools } from "../../phone-tools/agents"
import { basicTools } from "../../phone-tools/basic"
import { keepTools } from "../../phone-tools/keep"
import { phonePlugin } from "./opencode"

// The tools every channel gets: the basic phone tools (ping, battery,
// notify, share, open, clipboard), the agents_* tools for messages
// between the agents on this phone and agents_keep_running, to stay up
// while idle. Phone control is the full-only automation plugin.
export default phonePlugin("phonecando.mobile", [...basicTools, ...agentTools, ...keepTools])
