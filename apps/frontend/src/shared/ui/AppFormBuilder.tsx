import {
  DatePicker,
  type DatePickerProps,
  Form,
  type FormItemProps,
  InputNumber,
  type InputNumberProps,
  type InputProps,
  type SelectProps,
} from 'antd';
import type React from 'react';
import { AppInput as Input } from './AppInput/AppInput';
import { AppSelect as Select } from './AppSelect/AppSelect';

type TextAreaProps = React.ComponentProps<typeof Input.TextArea>;

interface BaseFieldProps {
  item: FormItemProps;
}

interface InputFieldProps extends BaseFieldProps {
  control?: InputProps;
}

interface TextAreaFieldProps extends BaseFieldProps {
  control?: TextAreaProps;
}

interface SelectFieldProps<ValueType = unknown> extends BaseFieldProps {
  control?: SelectProps<ValueType>;
  fullWidth?: boolean;
}

interface NumberFieldProps extends BaseFieldProps {
  control?: InputNumberProps;
  fullWidth?: boolean;
}

interface DateFieldProps extends BaseFieldProps {
  control?: DatePickerProps;
  fullWidth?: boolean;
}

function withWidth<TControl extends { style?: React.CSSProperties }>(
  control: TControl | undefined,
  fullWidth: boolean,
): TControl | undefined {
  if (!control) {
    return fullWidth ? ({ style: { width: '100%' } } as TControl) : undefined;
  }

  if (!fullWidth || control.style?.width) {
    return control;
  }

  return {
    ...control,
    style: {
      ...control.style,
      width: '100%',
    },
  };
}

export const AppFormBuilder = {
  Input: ({ item, control }: InputFieldProps) => (
    <Form.Item {...item}>
      <Input {...control} />
    </Form.Item>
  ),
  TextArea: ({ item, control }: TextAreaFieldProps) => (
    <Form.Item {...item}>
      <Input.TextArea {...control} />
    </Form.Item>
  ),
  Select: <ValueType,>({ item, control, fullWidth = true }: SelectFieldProps<ValueType>) => (
    <Form.Item {...item}>
      <Select {...withWidth(control, fullWidth)} />
    </Form.Item>
  ),
  InputNumber: ({ item, control, fullWidth = true }: NumberFieldProps) => (
    <Form.Item {...item}>
      <InputNumber {...withWidth(control, fullWidth)} />
    </Form.Item>
  ),
  DatePicker: ({ item, control, fullWidth = true }: DateFieldProps) => (
    <Form.Item {...item}>
      <DatePicker {...withWidth(control, fullWidth)} />
    </Form.Item>
  ),
};
