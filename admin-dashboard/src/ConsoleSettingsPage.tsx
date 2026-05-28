import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Terminal,
  Cpu,
  Database,
  Network,
  Shield,
  Bell,
  Code,
  Zap,
  Power,
  RefreshCcw,
  Save,
  CheckSquare,
  Square,
  ChevronRight,
  ChevronDown,
} from "lucide-react";

const ConsoleSettingsPage: React.FC = () => {
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    general: true,
    security: false,
    notifications: false,
    system: false,
  });

  const [settings, setSettings] = useState({
    instanceName: "SYS_CORE_MAIN",
    environment: "production",
    debugMode: false,
    maintenanceMode: false,
    twoFactorAuth: true,
    encryptionEnabled: true,
    roleBasedAccess: true,
    emailNotifications: true,
    smsAlerts: true,
    alertVolume: 80,
    apiVersioning: "v1",
    autoBackup: true,
    logLevel: "INFO",
  });

  const [hasChanges, setHasChanges] = useState(false);
  const [consoleOutput, setConsoleOutput] = useState<string[]>([
    "[SYS] Settings module loaded.",
    "[SYS] Ready for input...",
  ]);

  const addLog = (msg: string) => {
    setConsoleOutput((prev) => [...prev.slice(-4), msg]);
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
    addLog(`[UI] Toggled section: ${section.toUpperCase()}`);
  };

  const handleSettingChange = (key: string, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
    addLog(`[MOD] ${key.toUpperCase()} -> ${value}`);
  };

  const handleSave = () => {
    addLog("[SYS] Initializing save sequence...");
    setTimeout(() => {
      addLog(
        "[OK] Configuration successfully committed to persistent storage.",
      );
      setHasChanges(false);
    }, 800);
  };

  const SectionHeader = ({ id, icon: Icon, title, description }: any) => (
    <div
      className="flex items-center justify-between p-3 border border-green-500/30 hover:bg-green-900/20 hover:border-green-400 cursor-pointer transition-colors"
      onClick={() => toggleSection(id)}
    >
      <div className="flex items-center gap-3">
        <Icon size={18} className="text-green-500" />
        <div>
          <h2 className="text-sm font-bold tracking-widest uppercase">
            {title}
          </h2>
          <p className="text-xs text-green-700">{description}</p>
        </div>
      </div>
      <div>
        {expandedSections[id] ? (
          <ChevronDown size={18} />
        ) : (
          <ChevronRight size={18} />
        )}
      </div>
    </div>
  );

  const TerminalInput = ({ label, value, onChange }: any) => (
    <div className="mb-4">
      <label className="block text-xs uppercase mb-1 opacity-80">{label}</label>
      <div className="flex items-center bg-black border border-green-700 px-3 py-2 focus-within:border-green-400 focus-within:shadow-[0_0_8px_rgba(34,197,94,0.4)] transition-all">
        <span className="text-green-600 mr-2">{">"}</span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-transparent border-none outline-none w-full text-green-400 font-mono text-sm"
        />
        <span className="animate-pulse w-2 h-4 bg-green-500 inline-block"></span>
      </div>
    </div>
  );

  const TerminalToggle = ({ label, value, onChange }: any) => (
    <div
      className="flex items-center gap-3 mb-3 cursor-pointer group"
      onClick={() => onChange(!value)}
    >
      <div className="text-green-500 group-hover:text-green-400 transition-colors">
        {value ? <CheckSquare size={16} /> : <Square size={16} />}
      </div>
      <span
        className={`text-sm ${value ? "text-green-400" : "text-green-800"} uppercase group-hover:text-green-400 transition-colors`}
      >
        {label}
      </span>
    </div>
  );

  return (
    <div
      className="flex-1 bg-black font-mono text-green-500 p-6 overflow-hidden flex flex-col relative"
      style={{
        backgroundImage:
          "radial-gradient(circle at center, #001100 0%, #000000 100%)",
      }}
    >
      {/* Scanline Overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-10 bg-[linear-gradient(rgba(0,255,0,0)_50%,rgba(0,0,0,1)_50%)] bg-[length:100%_4px] z-50"></div>

      {/* Header */}
      <div className="border-b-2 border-green-700 pb-4 mb-6 flex justify-between items-end relative z-10">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Terminal size={28} className="animate-pulse" />
            <h1 className="text-2xl font-bold tracking-[0.2em] uppercase drop-shadow-[0_0_8px_rgba(34,197,94,0.8)]">
              SYS_CONSOLE // SETTINGS
            </h1>
          </div>
          <p className="text-xs text-green-700 tracking-wider">
            root@safeher-core:~# ./configure_system.sh
          </p>
        </div>

        <div className="flex gap-4">
          <button
            className="flex items-center gap-2 px-4 py-2 bg-black border border-green-700 hover:bg-green-900/30 hover:border-green-400 transition-all uppercase text-xs tracking-wider disabled:opacity-50"
            onClick={() => setHasChanges(false)}
            disabled={!hasChanges}
          >
            <RefreshCcw size={14} /> Revert
          </button>
          <button
            className="flex items-center gap-2 px-4 py-2 bg-green-900/20 border border-green-500 hover:bg-green-500 hover:text-black hover:shadow-[0_0_15px_rgba(34,197,94,0.6)] transition-all uppercase text-xs font-bold tracking-wider disabled:opacity-50 disabled:bg-transparent disabled:text-green-700 disabled:border-green-900"
            onClick={handleSave}
            disabled={!hasChanges}
          >
            <Save size={14} /> Commit Changes
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-green-700 scrollbar-track-black relative z-10 flex flex-col md:flex-row gap-6">
        {/* Settings Panels */}
        <div className="flex-1 space-y-4">
          {/* General */}
          <div className="border border-green-800 bg-black/50">
            <SectionHeader
              id="general"
              icon={Cpu}
              title="General Configuration"
              description="Core system identifiers and modes"
            />
            <AnimatePresence>
              {expandedSections.general && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: "auto" }}
                  exit={{ height: 0 }}
                  className="overflow-hidden border-t border-green-900"
                >
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TerminalInput
                      label="Instance Identifier"
                      value={settings.instanceName}
                      onChange={(v: string) =>
                        handleSettingChange("instanceName", v)
                      }
                    />
                    <TerminalInput
                      label="Environment Zone"
                      value={settings.environment}
                      onChange={(v: string) =>
                        handleSettingChange("environment", v)
                      }
                    />
                    <div>
                      <TerminalToggle
                        label="Enable Debug Tracing"
                        value={settings.debugMode}
                        onChange={(v: boolean) =>
                          handleSettingChange("debugMode", v)
                        }
                      />
                      <TerminalToggle
                        label="Engage Maintenance Mode"
                        value={settings.maintenanceMode}
                        onChange={(v: boolean) =>
                          handleSettingChange("maintenanceMode", v)
                        }
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Security */}
          <div className="border border-green-800 bg-black/50">
            <SectionHeader
              id="security"
              icon={Shield}
              title="Security & Access"
              description="Authentication protocols and encryption"
            />
            <AnimatePresence>
              {expandedSections.security && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: "auto" }}
                  exit={{ height: 0 }}
                  className="overflow-hidden border-t border-green-900"
                >
                  <div className="p-4 space-y-3">
                    <TerminalToggle
                      label="Enforce Multi-Factor Authentication"
                      value={settings.twoFactorAuth}
                      onChange={(v: boolean) =>
                        handleSettingChange("twoFactorAuth", v)
                      }
                    />
                    <TerminalToggle
                      label="Active End-to-End Payload Encryption"
                      value={settings.encryptionEnabled}
                      onChange={(v: boolean) =>
                        handleSettingChange("encryptionEnabled", v)
                      }
                    />
                    <TerminalToggle
                      label="Strict Role-Based Access Control (RBAC)"
                      value={settings.roleBasedAccess}
                      onChange={(v: boolean) =>
                        handleSettingChange("roleBasedAccess", v)
                      }
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* System */}
          <div className="border border-green-800 bg-black/50">
            <SectionHeader
              id="system"
              icon={Database}
              title="System Telemetry"
              description="Backup protocols and logging level"
            />
            <AnimatePresence>
              {expandedSections.system && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: "auto" }}
                  exit={{ height: 0 }}
                  className="overflow-hidden border-t border-green-900"
                >
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TerminalInput
                      label="Global Log Level"
                      value={settings.logLevel}
                      onChange={(v: string) =>
                        handleSettingChange("logLevel", v)
                      }
                    />
                    <TerminalInput
                      label="API Protocol Version"
                      value={settings.apiVersioning}
                      onChange={(v: string) =>
                        handleSettingChange("apiVersioning", v)
                      }
                    />
                    <div>
                      <TerminalToggle
                        label="Automated Vault Backups"
                        value={settings.autoBackup}
                        onChange={(v: boolean) =>
                          handleSettingChange("autoBackup", v)
                        }
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Side Console / Status Monitor */}
        <div className="w-full md:w-80 flex flex-col gap-4">
          <div className="border border-green-500 bg-green-950/20 p-4 relative shadow-[0_0_15px_rgba(34,197,94,0.1)]">
            <div className="absolute top-0 right-0 p-1 border-b border-l border-green-500 bg-green-500 text-black text-[10px] font-bold">
              LIVE
            </div>
            <h3 className="text-sm font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
              <Zap size={14} className="text-yellow-400" /> System Integrity
            </h3>

            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="opacity-70">Main_DB_Link</span>
                <span className="text-green-400">[ ONLINE ]</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="opacity-70">Secure_Socket</span>
                <span className="text-green-400">[ STABLE ]</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="opacity-70">Mem_Allocation</span>
                <span className="text-yellow-400">[ 76% USED ]</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="opacity-70">Firewall_Status</span>
                <span className="text-green-400 text-shadow-[0_0_5px_rgba(34,197,94,1)]">
                  [ ARMED ]
                </span>
              </div>
            </div>
          </div>

          <div className="border border-green-800 flex-1 flex flex-col">
            <div className="border-b border-green-800 bg-green-900/10 p-2 text-xs uppercase tracking-wider flex items-center gap-2">
              <Code size={14} /> Terminal Output
            </div>
            <div className="p-3 flex-1 flex flex-col justify-end text-xs space-y-1 opacity-80 font-mono">
              {consoleOutput.map((log, i) => (
                <div key={i}>{log}</div>
              ))}
              <div className="animate-pulse text-green-400 mt-2">_</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConsoleSettingsPage;
