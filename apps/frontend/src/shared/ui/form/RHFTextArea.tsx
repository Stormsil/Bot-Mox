import { Input } from 'antd';
import type { TextAreaProps } from 'antd/es/input';
import type { FieldPath, FieldValues } from 'react-hook-form';
import { RHFFormItem, type RHFFormItemProps } from './RHFFormItem';

type BaseProps<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>> = Omit<
  RHFFormItemProps<TFieldValues, TName>,
  'children'
>;

type RHFTextAreaProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = BaseProps<TFieldValues, TName> &
  Omit<TextAreaProps, 'value' | 'defaultValue' | 'onChange' | 'status'>;

export function RHFTextArea<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>(props: RHFTextAreaProps<TFieldValues, TName>) {
  const {
    control,
    name,
    label,
    rules,
    defaultValue,
    shouldUnregister,
    formItemProps,
    ...textAreaProps
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
        <Input.TextArea
          {...textAreaProps}
          value={typeof field.value === 'string' ? field.value : ((field.value ?? '') as string)}
          onChange={(event) => {
            field.onChange(event.target.value);
          }}
          onBlur={field.onBlur}
          name={field.name}
          ref={field.ref}
        />
      )}
    </RHFFormItem>
  );
}
