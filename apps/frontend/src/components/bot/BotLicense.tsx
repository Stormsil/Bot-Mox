import type { MenuProps } from 'antd';
import { Form, message } from 'antd';
import dayjs from 'dayjs';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  useCreateLicenseMutation,
  useDeleteLicenseMutation,
  useUpdateLicenseMutation,
} from '../../entities/resources/api/useLicenseMutations';
import { useLicensesQuery } from '../../entities/resources/api/useResourcesQueries';
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

export const BotLicense: React.FC<BotLicenseProps> = ({ bot }) => {
  const licensesQuery = useLicensesQuery();
  const createLicenseMutation = useCreateLicenseMutation();
  const updateLicenseMutation = useUpdateLicenseMutation();
  const deleteLicenseMutation = useDeleteLicenseMutation();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [editForm] = Form.useForm<LicenseFormValues>();
  const [createForm] = Form.useForm<LicenseFormValues>();
  const [assignForm] = Form.useForm<AssignLicenseFormValues>();

  useEffect(() => {
    if (!licensesQuery.error) {
      return;
    }
    console.error('Error loading license:', licensesQuery.error);
    message.error('Failed to load license data');
  }, [licensesQuery.error]);

  const allLicenses = useMemo(
    () => (licensesQuery.data || []).map(withLicenseRuntimeState) as LicenseInfo[],
    [licensesQuery.data],
  );
  const license = useMemo(
    () => allLicenses.find((item) => item.bot_ids?.includes(bot.id)) || null,
    [allLicenses, bot.id],
  );
  const loading = licensesQuery.isLoading;

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
      await updateLicenseMutation.mutateAsync({ id: license.id, payload });
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
        ...payload,
        created_at: now,
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
        id: selectedLicense.id,
        payload: {
          bot_ids: [...currentBotIds, bot.id],
          updated_at: Date.now(),
        },
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
        await deleteLicenseMutation.mutateAsync(license.id);
        message.success('License deleted (no bots assigned)');
      } else {
        await updateLicenseMutation.mutateAsync({
          id: license.id,
          payload: {
            bot_ids: newBotIds,
            updated_at: Date.now(),
          },
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
