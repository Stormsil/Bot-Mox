import { bindCssModuleCx } from '../../../shared/lib/classNames';
import modalLayoutStyles from '../VMDeleteVmModalLayout.module.css';
import modalListStyles from '../VMDeleteVmModalList.module.css';
import workspaceStyles from '../VMsPageWorkspace.module.css';

export const cx = bindCssModuleCx(workspaceStyles, modalLayoutStyles, modalListStyles);
