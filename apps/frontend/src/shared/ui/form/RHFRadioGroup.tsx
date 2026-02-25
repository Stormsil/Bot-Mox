import { Radio } from 'antd';
import type React from 'react';
import type { FieldPath, FieldValues } from 'react-hook-form';
import { RHFFormItem, type RHFFormItemProps } from './RHFFormItem';

type RadioGroupProps = React.ComponentProps<typeof Radio.Group>;

type BaseProps<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>> = Omit<
  RHFFormItemProps<TFieldValues, TName>,
  'children'
>;

type RHFRadioGroupProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = BaseProps<TFieldValues, TName> & Omit<RadioGroupProps, 'value' | 'defaultValue' | 'onChange'>;

export function RHFRadioGroup<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>(props: RHFRadioGroupProps<TFieldValues, TName>) {
  const {
    control,
    name,
    label,
    rules,
    defaultValue,
    shouldUnregister,
    formItemProps,
    ...radioGroupProps
  } = props;
  return (
    <RHFFormItem
      control={control}
      name={name}
      label={label}
      rules={rules}
      defaultValue={defaultValue}
      shouldUnregister={shouldUnregister}
      formItemProps={formItemProps}
    >
      {({ field }) => (
        <Radio.Group
          {...radioGroupProps}
          value={field.value}
          onChange={(event) => {
            field.onChange(event.target.value);
          }}
          onBlur={field.onBlur}
          name={field.name}
        />
      )}
    </RHFFormItem>
  );
}
