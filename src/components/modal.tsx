"use client";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
export default function Modal({
  title,
  children,
  onClose,
  wide = false,
  protectChanges = false,
  busy = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
  protectChanges?: boolean;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = "dialog-" + title.toLowerCase().replace(/[^a-z0-9]/g, "-");
  const [dirty, setDirty] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const close = () => {
    if (busy) return;
    if (protectChanges && dirty) setConfirmClose(true);
    else onClose();
  };
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = "";
      (previous?.isConnected
        ? previous
        : document.getElementById("main")
      )?.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={"modal " + (wide ? "wide" : "")}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
      aria-labelledby={titleId}
      onChangeCapture={() => setDirty(true)}
      onClickCapture={(e) => {
        if ((e.target as HTMLElement).closest("[data-form-change]"))
          setDirty(true);
      }}
    >
      <div className="modal-head">
        <h2 id={titleId}>{title}</h2>
        <button
          className="icon-button"
          onClick={close}
          disabled={busy}
          aria-label="Close dialog"
        >
          <X size={22} />
        </button>
      </div>
      <div className="modal-body">{children}</div>
      {confirmClose && (
        <div className="discard-prompt" role="alert">
          <p>
            <strong>Leave without saving?</strong> Your changes in this form
            will be lost.
          </p>
          <div className="form-actions">
            <button
              className="button secondary"
              onClick={() => setConfirmClose(false)}
            >
              Keep editing
            </button>
            <button className="button danger-button" onClick={onClose}>
              Discard changes
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
