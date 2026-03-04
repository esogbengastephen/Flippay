"use client";

import FSpinner from "@/components/FSpinner";

interface BulkEmailSectionProps {
  emailSubject: string;
  setEmailSubject: (v: string) => void;
  emailMessage: string;
  setEmailMessage: (v: string) => void;
  selectedCount: number;
  usersOnPage: number;
  sending: boolean;
  onSend: () => void;
}

export default function BulkEmailSection({
  emailSubject,
  setEmailSubject,
  emailMessage,
  setEmailMessage,
  selectedCount,
  usersOnPage,
  sending,
  onSend,
}: BulkEmailSectionProps) {
  return (
    <div className="bg-surface/60 backdrop-blur-[16px] rounded-2xl p-6 border border-accent/10">
      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <span className="material-icons-outlined text-white">mail</span>
        Send Bulk Email
      </h3>
      <div className="space-y-4">
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-accent/60 mb-2 font-bold">Email Subject</label>
          <input
            type="text"
            placeholder="Enter email subject"
            value={emailSubject}
            onChange={(e) => setEmailSubject(e.target.value)}
            className="w-full bg-primary border border-accent/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-accent/40 focus:ring-1 focus:ring-secondary focus:border-secondary focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-accent/60 mb-2 font-bold">Email Message</label>
          <textarea
            placeholder="Enter email message"
            value={emailMessage}
            onChange={(e) => setEmailMessage(e.target.value)}
            rows={4}
            className="w-full bg-primary border border-accent/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-accent/40 focus:ring-1 focus:ring-secondary focus:border-secondary focus:outline-none resize-none"
          />
        </div>
        <button
          onClick={onSend}
          disabled={!emailSubject || !emailMessage || sending || selectedCount === 0}
          className="flex items-center gap-2 px-4 py-2.5 bg-secondary text-primary font-bold rounded-lg hover:brightness-110 transition-all shadow-[0_0_10px_rgba(19,236,90,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {sending ? (
            <>
              <FSpinner size="xs" />
              Sending...
            </>
          ) : (
            <>Send to Selected ({selectedCount})</>
          )}
        </button>
        <p className="text-xs text-accent/60">
          {selectedCount > 0
            ? `Emails will be sent to ${selectedCount} selected user${selectedCount === 1 ? "" : "s"}`
            : `Select users from the table above. ${usersOnPage} user${usersOnPage === 1 ? "" : "s"} on this page.`}
        </p>
      </div>
    </div>
  );
}
