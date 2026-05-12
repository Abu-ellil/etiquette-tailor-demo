import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface Branch {
  id: number;
  name_ar: string;
  name_en: string;
  prefix: string;
}

interface BranchContextValue {
  activeBranchId: number;
  branches: Branch[];
  setActiveBranchId: (id: number) => void;
  activeBranch: Branch | undefined;
}

const BranchContext = createContext<BranchContextValue>({
  activeBranchId: 1,
  branches: [],
  setActiveBranchId: () => {},
  activeBranch: undefined,
});

export function BranchProvider({
  children,
  defaultBranchId,
}: {
  children: React.ReactNode;
  defaultBranchId: number;
}) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranchId, setActiveBranchId] = useState<number>(defaultBranchId);

  useEffect(() => {
    window.electronAPI.branches
      .getAll()
      .then((data: Branch[]) => setBranches(data || []))
      .catch(() => {});
  }, []);

  const activeBranch = branches.find((b) => b.id === activeBranchId);

  return (
    <BranchContext.Provider
      value={{ activeBranchId, branches, setActiveBranchId, activeBranch }}
    >
      {children}
    </BranchContext.Provider>
  );
}

export function useActiveBranch() {
  return useContext(BranchContext);
}
