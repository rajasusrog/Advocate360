import React from 'react';

export interface PluginPageRegistration {
  id: string;
  pluginId: string;
  title: string;
  iconName: string;
  renderComponent: () => React.ReactNode;
}

export interface PluginAgentRegistration {
  id: string;
  pluginId: string;
  agentName: string;
  capabilities: string[];
}

export interface PluginCommandRegistration {
  id: string;
  pluginId: string;
  label: string;
  actionTab: string;
}

class LegalOSPublicSDK {
  private registeredPages: PluginPageRegistration[] = [];
  private registeredAgents: PluginAgentRegistration[] = [];
  private registeredCommands: PluginCommandRegistration[] = [];

  public registerPage(page: PluginPageRegistration) {
    this.registeredPages.push(page);
    console.log(`[LegalOS SDK] Plugin "${page.pluginId}" registered custom Page "${page.title}"`);
  }

  public registerAgent(agent: PluginAgentRegistration) {
    this.registeredAgents.push(agent);
    console.log(`[LegalOS SDK] Plugin "${agent.pluginId}" registered custom AI Agent "${agent.agentName}"`);
  }

  public registerCommand(cmd: PluginCommandRegistration) {
    this.registeredCommands.push(cmd);
    console.log(`[LegalOS SDK] Plugin "${cmd.pluginId}" registered custom Command "${cmd.label}"`);
  }

  public getPages() {
    return [...this.registeredPages];
  }

  public getAgents() {
    return [...this.registeredAgents];
  }

  public getCommands() {
    return [...this.registeredCommands];
  }
}

export const sdk = new LegalOSPublicSDK();
