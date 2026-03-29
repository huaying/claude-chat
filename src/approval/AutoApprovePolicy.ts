export interface AutoApproveRule {
  /** Tool name — exact match or prefix wildcard (e.g. "Read", "Bash*"). */
  tool: string;
}

export interface AutoApproveConfig {
  enabled: boolean;
  rules: AutoApproveRule[];
}

export class AutoApprovePolicy {
  constructor(private readonly config: AutoApproveConfig) {}

  shouldAutoApprove(toolName: string): boolean {
    if (!this.config.enabled) return false;

    return this.config.rules.some((rule) => this.matchTool(rule.tool, toolName));
  }

  private matchTool(pattern: string, toolName: string): boolean {
    if (pattern === "*") return true;
    if (pattern.endsWith("*"))
      return toolName.startsWith(pattern.slice(0, -1));
    return pattern === toolName;
  }
}
