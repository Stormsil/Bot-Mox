import { useModalForm } from '@refinedev/antd';
import { type HttpError, useDelete, useList, useUpdate } from '@refinedev/core';
import type { FormInstance, MenuProps } from 'antd';
import { Form, message } from 'antd';
import dayjs from 'dayjs';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import type { BotLicense as BotLicenseRecord } from '../../entities/resources/model/types';
import type {
  AssignLicenseFormValues,
  BotLicenseProps,
  LicenseFormValues,
  LicenseInfo,
} from './license';
import {
  AssignLicenseModal,
  buildAddMenuItems,
  buildLicensePayload,
  getAvailableLicenses,
  getTypeOptions,
  LicenseDetailsCard,
  LicenseEmptyCard,
  LicenseFormModal,
  LicenseLoadingCard,
  withLicenseRuntimeState,
} from './license';
import styles from './license/license.module.css';

const RESOURCE_REFETCH_INTERVAL_MS = 7_000;
const RESOURCE_LIST_PAGE_SIZE = 5_000;

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

export const BotLicense: React.FC<BotLicenseProps> = ({ bot }) => {
  const licensesList = useList<BotLicenseRecord>({
    resource: 'licenses',
    pagination: { mode: 'server', currentPage: 1, pageSize: RESOURCE_LIST_PAGE_SIZE },
    queryOptions: { refetchInterval: RESOURCE_REFETCH_INTERVAL_MS },
  });
  const createLicenseModal = useModalForm<
    BotLicenseRecord,
    HttpError,
    Omit<BotLicenseRecord, 'id'>
  >({
    resource: 'licenses',
    action: 'create',
    redirect: false,
    invalidates: ['resourceAll'],
    syncWithLocation: false,
  });
  const editLicenseModal = useModalForm<BotLicenseRecord, HttpError, Partial<BotLicenseRecord>>({
    resource: 'licenses',
    action: 'edit',
    redirect: false,
    invalidates: ['resourceAll'],
    syncWithLocation: false,
  });
  const updateLicenseMutation = useUpdate<BotLicenseRecord, HttpError, Partial<BotLicenseRecord>>();
  const deleteLicenseMutation = useDelete<BotLicenseRecord>();
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const createForm = createLicenseModal.form as unknown as FormInstance<LicenseFormValues>;
  const editForm = editLicenseModal.form as unknown as FormInstance<LicenseFormValues>;
  const [assignForm] = Form.useForm<AssignLicenseFormValues>();

  useEffect(() => {
    if (!licensesList.query.error) {
      return;
    }
    console.error('Error loading license:', licensesList.query.error);
    message.error('Failed to load license data');
  }, [licensesList.query.error]);

  const allLicenses = useMemo(
    () => (licensesList.result.data || []).map(withLicenseRuntimeState) as LicenseInfo[],
    [licensesList.result.data],
  );
  const license = useMemo(
    () => allLicenses.find((item) => item.bot_ids?.includes(bot.id)) || null,
    [allLicenses, bot.id],
  );
  const loading = licensesList.query.isLoading;

  const availableLicenses = useMemo(
    () => getAvailableLicenses(allLicenses, bot.id),
    [allLicenses, bot.id],
  );
  const typeOptions = useMemo(() => getTypeOptions(allLicenses), [allLicenses]);
  const addMenuItems = useMemo(
    () => buildAddMenuItems(availableLicenses.length),
    [availableLicenses.length],
  );

  const copyKey = () => {
    if (!license?.key) return;
    navigator.clipboard.writeText(license.key);
    message.success('License key copied');
  };

  const openEditModal = () => {
    if (!license) return;
    editForm.setFieldsValue({
      key: license.key,
      type: license.type,
      expires_at: dayjs(license.expires_at),
    });
    editLicenseModal.show(license.id);
  };

  const openCreateModal = () => {
    createForm.resetFields();
    createForm.setFieldsValue({
      expires_at: dayjs().add(30, 'days'),
    });
    createLicenseModal.show();
  };

  const openAssignModal = () => {
    assignForm.resetFields();
    setIsAssignModalOpen(true);
  };

  const handleEditSave = async (values: LicenseFormValues) => {
    if (!license || !editLicenseModal.id) return;
    if (editSubmitting) {
      return;
    }

    setEditSubmitting(true);
    try {
      const payload = buildLicensePayload(values, license.bot_ids || []);
      await editLicenseModal.onFinish(payload);
      message.success('License updated');
      editLicenseModal.close();
      editForm.resetFields();
    } catch (error) {
      console.error('Error saving license:', error);
      message.error(`Failed to save license: ${getErrorMessage(error, 'Unknown error')}`);
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleCreate = async (values: LicenseFormValues) => {
    if (createSubmitting) {
      return;
    }

    setCreateSubmitting(true);
    try {
      const now = Date.now();
      const payload = buildLicensePayload(values, [bot.id], now);
      await createLicenseModal.onFinish({
        ...payload,
        created_at: now,
      });
      message.success('License created and assigned to bot');
      createLicenseModal.close();
      createForm.resetFields();
    } catch (error) {
      console.error('Error creating license:', error);
      message.error(`Failed to create license: ${getErrorMessage(error, 'Unknown error')}`);
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleAssign = async (values: AssignLicenseFormValues) => {
    if (assignSubmitting) {
      return;
    }

    setAssignSubmitting(true);
    try {
      const selectedLicense = allLicenses.find((item) => item.id === values.license_id);
      if (!selectedLicense) return;

      const currentBotIds = selectedLicense.bot_ids || [];
      if (currentBotIds.includes(bot.id)) {
        message.warning('Bot is already assigned to this license');
        return;
      }

      await updateLicenseMutation.mutateAsync({
        resource: 'licenses',
        id: selectedLicense.id,
        values: {
          bot_ids: [...currentBotIds, bot.id],
          updated_at: Date.now(),
        },
        invalidates: ['resourceAll'],
      });
      message.success('Bot assigned to license');
      setIsAssignModalOpen(false);
      assignForm.resetFields();
    } catch (error) {
      console.error('Error assigning license:', error);
      message.error(`Failed to assign license: ${getErrorMessage(error, 'Unknown error')}`);
    } finally {
      setAssignSubmitting(false);
    }
  };

  const handleUnassign = async () => {
    if (!license) return;
    try {
      const newBotIds = (license.bot_ids || []).filter((id) => id !== bot.id);
      if (newBotIds.length === 0) {
        await deleteLicenseMutation.mutateAsync({
          resource: 'licenses',
          id: license.id,
          invalidates: ['resourceAll'],
        });
        message.success('License deleted (no bots assigned)');
      } else {
        await updateLicenseMutation.mutateAsync({
          resource: 'licenses',
          id: license.id,
          values: {
            bot_ids: newBotIds,
            updated_at: Date.now(),
          },
          invalidates: ['resourceAll'],
        });
        message.success('Bot unassigned from license');
      }
    } catch (error) {
      console.error('Error unassigning bot:', error);
      message.error('Failed to unassign bot');
    }
  };

  const handleAddMenuClick: MenuProps['onClick'] = (info) => {
    if (info.key === 'assign') {
      openAssignModal();
      return;
    }
    openCreateModal();
  };

  if (loading) {
    return <LicenseLoadingCard />;
  }

  if (!license) {
    return (
      <div className={styles['bot-license']}>
        <LicenseEmptyCard addMenuItems={addMenuItems} onAddMenuClick={handleAddMenuClick} />

        <LicenseFormModal
          open={createLicenseModal.open}
          title="Create New License"
          okText="Create"
          form={createForm}
          typeOptions={typeOptions}
          submitting={createSubmitting || createLicenseModal.formLoading}
          onCancel={() => {
            createLicenseModal.close();
            createForm.resetFields();
          }}
          onSubmit={handleCreate}
        />

        <AssignLicenseModal
          open={isAssignModalOpen}
          form={assignForm}
          availableLicenses={availableLicenses}
          submitting={assignSubmitting || updateLicenseMutation.mutation.isPending}
          onCancel={() => {
            setIsAssignModalOpen(false);
            assignForm.resetFields();
          }}
          onSubmit={handleAssign}
        />
      </div>
    );
  }

  return (
    <div className={styles['bot-license']}>
      <LicenseDetailsCard
        bot={bot}
        license={license}
        onEdit={openEditModal}
        onCopyKey={copyKey}
        onUnassign={handleUnassign}
      />

      <LicenseFormModal
        open={editLicenseModal.open}
        title="Edit License"
        okText="Update"
        form={editForm}
        typeOptions={typeOptions}
        submitting={editSubmitting || editLicenseModal.formLoading}
        onCancel={() => {
          editLicenseModal.close();
          editForm.resetFields();
        }}
        onSubmit={handleEditSave}
      />
    </div>
  );
};
