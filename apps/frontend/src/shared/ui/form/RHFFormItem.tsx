import { Form, type FormItemProps } from 'antd';
import type React from 'react';
import {
  type Control,
  Controller,
  type ControllerFieldState,
  type ControllerProps,
  type ControllerRenderProps,
  type FieldPath,
  type FieldPathValue,
  type FieldValues,
} from 'react-hook-form';

type RHFFormItemRenderParams<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = {
  field: ControllerRenderProps<TFieldValues, TName>;
  fieldState: ControllerFieldState;
};

export interface RHFFormItemProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> {
  // biome-ignore lint/suspicious/noExplicitAny: RHF resolver can use transformed values type different from TFieldValues
  control: Control<TFieldValues, any, any>;
  name: TName;
  label?: React.ReactNode;
  rules?: ControllerProps<TFieldValues, TName>['rules'];
  defaultValue?: FieldPathValue<TFieldValues, TName>;
  shouldUnregister?: boolean;
  formItemProps?: Omit<FormItemProps, 'children' | 'label' | 'help' | 'validateStatus'>;
  children: (params: RHFFormItemRenderParams<TFieldValues, TName>) => React.ReactNode;
}

export function RHFFormItem<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({
  control,
  name,
  label,
  rules,
  defaultValue,
  shouldUnregister,
  formItemProps,
  children,
}: RHFFormItemProps<TFieldValues, TName>) {
  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      defaultValue={defaultValue}
      shouldUnregister={shouldUnregister}
      render={({ field, fieldState }) => (
        <Form.Item
          label={label}
          validateStatus={fieldState.error ? 'error' : undefined}
          help={fieldState.error?.message}
          {...formItemProps}
        >
          {children({ field, fieldState })}
        </Form.Item>
      )}
    />
  );
}
