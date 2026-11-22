import { useState } from "react";
import { Workspace } from "./components/Workspace";
import type { ToolId } from "./components/Workspace";

export default function App() {
  const [tool, setTool] = useState<ToolId>("move");

  return (
    <div className="gusine">
      <Workspace tool={tool} onToolChange={setTool} />
    </div>
  );
}
