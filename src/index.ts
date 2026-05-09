import { render } from "ink";
import React from "react";
import { DevOpsAgentApp } from "./ui/App.ts";

render(React.createElement(DevOpsAgentApp), {
	alternateScreen: true,
});
