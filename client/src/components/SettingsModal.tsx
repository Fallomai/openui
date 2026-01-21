import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Key, Check, AlertCircle, Loader2, ExternalLink } from "lucide-react";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [apiKey, setApiKey] = useState("");
  const [hasExistingKey, setHasExistingKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; user?: { name: string; email: string }; error?: string } | null>(null);
  const [defaultBaseBranch, setDefaultBaseBranch] = useState("main");
  const [createWorktree, setCreateWorktree] = useState(true);
  const [ticketPromptTemplate, setTicketPromptTemplate] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Load existing config
  useEffect(() => {
    if (open) {
      fetch("/api/linear/config")
        .then((res) => res.json())
        .then((config) => {
          setHasExistingKey(config.hasApiKey);
          setDefaultBaseBranch(config.defaultBaseBranch || "main");
          setCreateWorktree(config.createWorktree ?? true);
          setTicketPromptTemplate(config.ticketPromptTemplate || "");
        })
        .catch(console.error);
    }
  }, [open]);

  const handleValidate = async () => {
    if (!apiKey.trim()) return;

    setIsValidating(true);
    setValidationResult(null);

    try {
      const res = await fetch("/api/linear/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      const result = await res.json();
      setValidationResult(result);
    } catch (e) {
      setValidationResult({ valid: false, error: "Failed to validate" });
    } finally {
      setIsValidating(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      await fetch("/api/linear/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: apiKey.trim() || undefined,
          defaultBaseBranch,
          createWorktree,
          ticketPromptTemplate: ticketPromptTemplate || undefined,
        }),
      });

      if (apiKey.trim()) {
        setHasExistingKey(true);
      }
      setApiKey("");
      setValidationResult(null);
      onClose();
    } catch (e) {
      console.error("Failed to save settings:", e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveKey = async () => {
    setIsSaving(true);
    try {
      await fetch("/api/linear/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: "" }),
      });
      setHasExistingKey(false);
      setApiKey("");
      setValidationResult(null);
    } catch (e) {
      console.error("Failed to remove key:", e);
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          >
            <div className="pointer-events-auto w-full max-w-md mx-4">
            <div className="bg-canvas-lighter rounded-xl border border-canvas-lighter shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="px-5 py-4 border-b border-canvas-lighter flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Settings</h2>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-canvas transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-5 space-y-6">
                {/* Linear Integration */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded bg-indigo-500/20 flex items-center justify-center">
                      <svg className="w-4 h-4 text-indigo-400" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3 7.5L7.5 3H21v13.5L16.5 21H3V7.5z" />
                      </svg>
                    </div>
                    <h3 className="text-sm font-medium text-white">Linear Integration</h3>
                  </div>

                  {hasExistingKey ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-green-500/10 border border-green-500/20">
                        <Check className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-green-400">API key configured</span>
                        <button
                          onClick={handleRemoveKey}
                          className="ml-auto text-xs text-zinc-500 hover:text-red-400 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                      <p className="text-xs text-zinc-500">
                        You can start sessions from Linear tickets.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-zinc-500">
                        Connect Linear to start agent sessions from tickets.{" "}
                        <a
                          href="https://linear.app/settings/api"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-0.5"
                        >
                          Get your API key
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </p>

                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                          <input
                            type="password"
                            value={apiKey}
                            onChange={(e) => {
                              setApiKey(e.target.value);
                              setValidationResult(null);
                            }}
                            placeholder="lin_api_..."
                            className="w-full pl-9 pr-3 py-2 rounded-md bg-canvas border border-canvas-lighter text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
                          />
                        </div>
                        <button
                          onClick={handleValidate}
                          disabled={!apiKey.trim() || isValidating}
                          className="px-3 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                        >
                          {isValidating ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            "Validate"
                          )}
                        </button>
                      </div>

                      {validationResult && (
                        <div
                          className={`flex items-center gap-2 px-3 py-2 rounded-md ${
                            validationResult.valid
                              ? "bg-green-500/10 border border-green-500/20"
                              : "bg-red-500/10 border border-red-500/20"
                          }`}
                        >
                          {validationResult.valid ? (
                            <>
                              <Check className="w-4 h-4 text-green-500" />
                              <span className="text-sm text-green-400">
                                Connected as {validationResult.user?.name}
                              </span>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="w-4 h-4 text-red-500" />
                              <span className="text-sm text-red-400">
                                {validationResult.error}
                              </span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Git Settings */}
                <div>
                  <h3 className="text-sm font-medium text-white mb-3">Git Settings</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-zinc-500 block mb-1.5">
                        Default base branch
                      </label>
                      <input
                        type="text"
                        value={defaultBaseBranch}
                        onChange={(e) => setDefaultBaseBranch(e.target.value)}
                        placeholder="main"
                        className="w-full px-3 py-2 rounded-md bg-canvas border border-canvas-lighter text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
                      />
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={createWorktree}
                        onChange={(e) => setCreateWorktree(e.target.checked)}
                        className="w-4 h-4 rounded border-zinc-600 bg-canvas text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0"
                      />
                      <span className="text-sm text-zinc-300">
                        Create git worktree for ticket branches
                      </span>
                    </label>
                    <p className="text-xs text-zinc-600 ml-6">
                      Each ticket gets an isolated working directory
                    </p>
                  </div>
                </div>

                {/* Ticket Prompt Template */}
                <div>
                  <h3 className="text-sm font-medium text-white mb-3">Ticket Prompt</h3>
                  <div className="space-y-2">
                    <p className="text-xs text-zinc-500">
                      Message sent to the agent when starting from a ticket. Use <code className="text-indigo-400">{"{{url}}"}</code>, <code className="text-indigo-400">{"{{id}}"}</code>, <code className="text-indigo-400">{"{{title}}"}</code> as placeholders.
                    </p>
                    <textarea
                      value={ticketPromptTemplate}
                      onChange={(e) => setTicketPromptTemplate(e.target.value)}
                      placeholder="Here is the ticket for this session: {{url}}&#10;&#10;Please use the Linear MCP tool or fetch the URL to read the full ticket details before starting work."
                      rows={4}
                      className="w-full px-3 py-2 rounded-md bg-canvas border border-canvas-lighter text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors resize-none font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-4 border-t border-canvas-lighter flex justify-end gap-2">
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-md text-sm text-zinc-400 hover:text-white hover:bg-canvas transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving || (!!apiKey.trim() && !validationResult?.valid)}
                  className="px-4 py-1.5 rounded-md text-sm font-medium bg-white text-canvas hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
