import type { FormInstance } from 'antd';
import dayjs from 'dayjs';
import type { LicenseWithBots } from '../../../types';
import type { LicenseFormValues } from './types';

export const setLicenseEditorDefaults = (
  form: FormInstance<LicenseFormValues>,
  license?: LicenseWithBots,
) => {
  if (license) {
    form.setFieldsValue({
      key: license.key,
      type: license.type,
      expires_at: dayjs(license.expires_at),
    });
    return;
  }

  form.resetFields();
  form.setFieldsValue({
    expires_at: dayjs().add(30, 'days'),
  });
};
