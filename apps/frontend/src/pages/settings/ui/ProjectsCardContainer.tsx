import type React from 'react';
import { useState } from 'react';
import type { ProjectSettings } from '../../../entities/settings/model/projectSettings';
import { ProjectsCard } from '../SettingsSections';

interface ProjectsCardContainerProps {
  projectEntries: Array<[string, ProjectSettings]>;
}

export const ProjectsCardContainer: React.FC<ProjectsCardContainerProps> = ({ projectEntries }) => {
  const [projectsVisible, setProjectsVisible] = useState(false);

  return (
    <ProjectsCard
      projectsVisible={projectsVisible}
      projectEntries={projectEntries}
      onToggleVisibility={() => setProjectsVisible((prev) => !prev)}
    />
  );
};
