"use client";

import * as React from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/loading";
import { useHydrated } from "@/hooks/use-hydrated";

/** Common page frame: header + hydration gate so persisted data never flashes. */
export function AdminPage({ title, description, actions, children }) {
  const hydrated = useHydrated();
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} actions={actions} />
      {hydrated ? children : <PageSkeleton />}
    </div>
  );
}

export function useConfirm() {
  const [state, setState] = React.useState({ open: false, busy: false });
  return {
    open: state.open,
    payload: state.payload,
    busy: state.busy,
    ask: (payload) => setState({ open: true, payload, busy: false }),
    close: () => setState((s) => ({ ...s, open: false, busy: false })),
    setBusy: (busy) => setState((s) => ({ ...s, busy })),
    onOpenChange: (open) => setState((s) => ({ ...s, open })),
  };
}
