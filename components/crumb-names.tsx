"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/*
 * Names for the breadcrumb trail. The trail is built from the address, which
 * only has ids; a detail page knows who an id is and says so with
 * `<CrumbName id={patient.id} name="Ramon Dela Cruz" />`.
 */
type Names = Record<string, string>;
type Parent = { href: string; label: string } | null;
const Ctx = createContext<{
  names: Names;
  set: (id: string, name: string) => void;
  parent: Parent;
  setParent: (p: Parent) => void;
}>({ names: {}, set: () => {}, parent: null, setParent: () => {} });

export function CrumbNamesProvider({ children }: { children: ReactNode }) {
  const [names, setNames] = useState<Names>({});
  const [parent, setParentState] = useState<Parent>(null);
  const setParent = (p: Parent) =>
    setParentState((old) => (old?.href === p?.href && old?.label === p?.label ? old : p));
  return (
    <Ctx.Provider value={{ names, set: (id, name) => setNames((n) => (n[id] === name ? n : { ...n, [id]: name })), parent, setParent }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCrumbNames() {
  return useContext(Ctx).names;
}

/** Renders nothing: tells the trail what to call this id. */
export function CrumbName({ id, name }: { id: string; name: string }) {
  const { set } = useContext(Ctx);
  useEffect(() => set(id, name), [id, name, set]);
  return null;
}

export function useBackTo() {
  return useContext(Ctx).parent;
}

/**
 * Renders nothing: the page above this one, for a page whose address doesn't
 * say (a note's patient). Used when there's nowhere you came from.
 */
export function BackTo({ href, label }: { href: string; label: string }) {
  const { setParent } = useContext(Ctx);
  useEffect(() => {
    setParent({ href, label });
    return () => setParent(null);
  }, [href, label]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
