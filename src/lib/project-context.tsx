'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { fetchWithCache } from './swr-cache';

export interface Project {
  id: string;
  name: string;
  code: string;
  location?: string;
  status: string;
}

interface ProjectContextValue {
  projects: Project[];
  selectedProject: Project | null;
  setSelectedProject: (p: Project) => void;
  loading: boolean;
}

const ProjectContext = createContext<ProjectContextValue>({
  projects: [],
  selectedProject: null,
  setSelectedProject: () => {},
  loading: true,
});

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProjectState] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWithCache<Project[]>('/api/projects', 15000)
      .then((data: Project[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setProjects(data);
          // Restore last selection from localStorage
          const saved = typeof window !== 'undefined' ? localStorage.getItem('selectedProjectId') : null;
          const match = saved ? data.find((p) => p.id === saved) : null;
          setSelectedProjectState(match || data[0]);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const setSelectedProject = (p: Project) => {
    setSelectedProjectState(p);
    localStorage.setItem('selectedProjectId', p.id);
  };

  return (
    <ProjectContext.Provider value={{ projects, selectedProject, setSelectedProject, loading }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  return useContext(ProjectContext);
}
