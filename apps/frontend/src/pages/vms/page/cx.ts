import modalLayoutStyles from '../VMDeleteVmModalLayout.module.css';
import modalListStyles from '../VMDeleteVmModalList.module.css';
import workspaceStyles from '../VMsPageWorkspace.module.css';

export function cx(classNames: string): string {
  return classNames
    .split(' ')
    .filter(Boolean)
    .map(
      (name) => workspaceStyles[name] || modalLayoutStyles[name] || modalListStyles[name] || name,
    )
    .join(' ');
}
