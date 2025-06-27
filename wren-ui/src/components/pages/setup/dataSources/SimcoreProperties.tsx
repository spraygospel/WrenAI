// wren-ui/src/components/pages/setup/dataSources/SimcoreProperties.tsx
import { Alert, Form, Input } from 'antd';
import { ERROR_TEXTS } from '@/utils/error';

export default function SimcoreProperties() {
  return (
    <>
      <Form.Item
        label="Display name"
        name="displayName"
        required
        rules={[
          {
            required: true,
            message: ERROR_TEXTS.CONNECTION.DISPLAY_NAME.REQUIRED,
          },
        ]}
      >
        <Input placeholder="e.g. My Company ERP" />
      </Form.Item>
      <Form.Item
        label="API URL"
        name="apiUrl"
        required
        rules={[
          {
            required: true,
            message: 'API URL is required.',
          },
          {
            type: 'url',
            message: 'Please enter a valid URL.',
          },
        ]}
      >
        <Input placeholder="http://12.129.321.221:5001" />
      </Form.Item>
      
      <Alert
        className="!mb-6"
        message="Please ensure the erp_schema.json file is placed in the wren-ui/public/ directory before proceeding."
        type="info"
        showIcon
      />

      <Form.Item
        label="Username"
        name="user"
        required
        rules={[
          {
            required: true,
            message: ERROR_TEXTS.CONNECTION.USERNAME.REQUIRED,
          },
        ]}
      >
        <Input placeholder="AXAinsurance" />
      </Form.Item>
      <Form.Item
        label="Password"
        name="password"
        required
        rules={[
          {
            required: true,
            message: ERROR_TEXTS.CONNECTION.PASSWORD.REQUIRED,
          },
        ]}
      >
        <Input.Password placeholder="input password" />
      </Form.Item>
    </>
  );
}