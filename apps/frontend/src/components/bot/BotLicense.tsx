import { type HttpError, useCreate, useDelete, useList, useUpdate } from '@refinedev/core';
import type { MenuProps } from 'antd';
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

export const BotLicense: React.FC<BotLicenseProps> = ({ bot }) => {
  const licensesList = useList<BotLicenseRecord>({
    resource: 'licenses',
    pagination: { mode: 'server', currentPage: 1, pageSize: RESOURCE_LIST_PAGE_SIZE },
    queryOptions: { refetchInterval: RESOURCE_REFETCH_INTERVAL_MS },
  });
  const createLicenseMutation = useCreate<
    BotLicenseRecord,
    HttpError,
    Omit<BotLicenseRecord, 'id'>
  >();
  const updateLicenseMutation = useUpdate<BotLicenseRecord, HttpError, Partial<BotLicenseRecord>>();
  const deleteLicenseMutation = useDelete<BotLicenseRecord>();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [editForm] = Form.useForm<LicenseFormValues>();
  const [createForm] = Form.useForm<LicenseFormValues>();
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
    setIsEditModalOpen(true);
  };

  const openCreateModal = () => {
    createForm.resetFields();
    createForm.setFieldsValue({
      expires_at: dayjs().add(30, 'days'),
    });
    setIsCreateModalOpen(true);
  };

  const openAssignModal = () => {
    assignForm.resetFields();
    setIsAssignModalOpen(true);
  };

  const handleEditSave = async (values: LicenseFormValues) => {
    if (!license) return;
    try {
      const payload = buildLicensePayload(values, license.bot_ids || []);
      await updateLicenseMutation.mutateAsync({
        resource: 'licenses',
        id: license.id,
        values: payload,
        invalidates: ['resourceAll'],
      });
      message.success('License updated');
      setIsEditModalOpen(false);
      editForm.resetFields();
    } catch (error) {
      console.error('Error saving license:', error);
      message.error('Failed to save license');
    }
  };

  const handleCreate = async (values: LicenseFormValues) => {
    try {
      const now = Date.now();
      const payload = buildLicensePayload(values, [bot.id], now);
      await createLicenseMutation.mutateAsync({
        resource: 'licenses',
        values: {
          ...payload,
          created_at: now,
        },
        invalidates: ['resourceAll'],
      });
      message.success('License created and assigned to bot');
      setIsCreateModalOpen(false);
      createForm.resetFields();
    } catch (error) {
      console.error('Error creating license:', error);
      message.error('Failed to create license');
    }
  };

  const handleAssign = async (values: AssignLicenseFormValues) => {
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
      message.error('Failed to assign license');
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
          open={isCreateModalOpen}
          title="Create New License"
          okText="Create"
          form={createForm}
          typeOptions={typeOptions}
          onCancel={() => {
            setIsCreateModalOpen(false);
            createForm.resetFields();
          }}
          onSubmit={handleCreate}
        />

        <AssignLicenseModal
          open={isAssignModalOpen}
          form={assignForm}
          availableLicenses={availableLicenses}
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
        open={isEditModalOpen}
        title="Edit License"
        okText="Update"
        form={editForm}
        typeOptions={typeOptions}
        onCancel={() => {
          setIsEditModalOpen(false);
          editForm.resetFields();
        }}
        onSubmit={handleEditSave}
      />
    </div>
  );
};
