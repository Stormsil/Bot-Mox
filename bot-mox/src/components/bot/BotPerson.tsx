import React, { useState, useEffect, useCallback } from 'react';
import { Card, Form, Input, Button, Select, message, Alert, Spin, Row, Col, Tooltip, Badge } from 'antd';
import { SaveOutlined, ExclamationCircleOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { ref, update } from 'firebase/database';
import { database } from '../../utils/firebase';
import type { PersonData } from '../../types';
import './BotPerson.css';

const { Option } = Select;

// Extended Bot interface with person field
interface BotWithPerson {
  id: string;
  name: string;
  person?: {
    first_name?: string;
    last_name?: string;
    birth_date?: string;
    country?: string;
    city?: string;
    address?: string;
    zip?: string;
  };
}

interface BotPersonProps {
  bot: BotWithPerson;
}

// Available countries for data generation
const countries = ['Turkey', 'Ukraine'];

// Turkish names data
const turkishFirstNames = [
  'Mehmet', 'Ahmet', 'Ali', 'Mustafa', 'Hüseyin', 'Hasan', 'İbrahim', 'Osman', 'Yusuf', 'Murat',
  'Fatma', 'Ayşe', 'Emine', 'Hatice', 'Zeynep', 'Elif', 'Meryem', 'Şerife', 'Sultan', 'Havva',
  'Abdulhaşim', 'Akarsu', 'Akdoğ', 'Altuna', 'Anı', 'Argın', 'Atfi', 'Atl', 'Ayişe', 'Ayni',
  'Aysima', 'Ayulduz', 'Ayşekadin', 'Bahaittin', 'Bahti', 'Baybek', 'Beray', 'Bilal', 'Boz', 'Cevher',
  'Dadak', 'Dayı', 'Demirbüken', 'Dinçsay', 'Duruöz', 'Edaviye', 'Ejder', 'Ercihan', 'Eroğan', 'Esmanperi'
];

const turkishLastNames = [
  'Yılmaz', 'Kaya', 'Demir', 'Şahin', 'Çelik', 'Yıldız', 'Öztürk', 'Aydın', 'Özdemir', 'Arslan',
  'Doğan', 'Kılıç', 'Aslan', 'Çetin', 'Kara', 'Koç', 'Kurt', 'Özkan', 'Şimşek', 'Polat',
  'Demir', 'Olmaz', 'Kırış', 'Yeşil', 'Kaskalan', 'Ulutaş', 'Aydın', 'İlker', 'Şen', 'Dayangaç',
  'Arslankeçecioğlu', 'Akdemir', 'Güzelküçük', 'Yılmaz', 'Şahin', 'Bayraktaroğlu', 'Atik', 'Babayiğit',
  'Demirel', 'Avlanır', 'Gülşan', 'Yazak', 'Apaydın', 'Demirtaş', 'Filiz', 'Dere', 'Özcan', 'Bozoğlu',
  'Kaan', 'Fişekci'
];

// Ukrainian names data
const ukrainianFirstNames = [
  'Олександр', 'Андрій', 'Володимир', 'Сергій', 'Іван', 'Михайло', 'Юрій', 'Віктор', 'Петро', 'Дмитро',
  'Олена', 'Наталія', 'Тетяна', 'Світлана', 'Ірина', 'Марія', 'Анна', 'Людмила', 'Галина', 'Валентина',
  'Олег', 'Роман', 'Максим', 'Артем', 'Богдан', 'Євген', 'Павло', 'Тарас', 'Микола', 'Григорій',
  'Катерина', 'Юлія', 'Оксана', 'Любов', 'Віра', 'Надія', 'Софія', 'Аліна', 'Дарина', 'Вероніка'
];

const ukrainianLastNames = [
  'Шевченко', 'Коваленко', 'Бондаренко', 'Ткаченко', 'Петренко', 'Олійник', 'Кравченко', 'Шевчук',
  'Гаврилюк', 'Поліщук', 'Ковальчук', 'Кузьменко', 'Марченко', 'Литвиненко', 'Іванов', 'Сидоренко',
  'Мельник', 'Бойко', 'Коваленко', 'Мороз', 'Руденко', 'Савченко', 'Павленко', 'Захарченко',
  'Харченко', 'Макаренко', 'Федоренко', 'Ткачук', 'Гнатюк', 'Данилюк', 'Лисенко', 'Романюк',
  'Костенко', 'Михайленко', 'Василенко', 'Пономаренко', 'Гриценко', 'Яценко', 'Дяченко', 'Тимошенко'
];

// Sample addresses from data
const turkeyAddresses = [
  { street: 'Uludağ Caddesi', houseNumber: '250', locality: 'Yiğitali', region: 'Osmangazi̇', province: 'Bursa', postalCode: '16370' },
  { street: 'Özgül Sok', houseNumber: '3', locality: 'Ömeranlı', region: 'Kulu', province: 'Konya', postalCode: '42770' },
  { street: 'Derviş Görgün Caddesi', houseNumber: '43', locality: 'Umurça', region: 'Bodrum', province: 'Muğla', postalCode: '48470' },
  { street: 'Ömer Akpınar Caddesi', houseNumber: '39', locality: 'Alipaşa', region: 'Akpınar', province: 'Kırşehir', postalCode: '40320' },
  { street: 'Esat Caddesi', houseNumber: '143', locality: 'Küçükesat', region: 'Çankaya', province: 'Ankara', postalCode: '06660' },
  { street: 'Şehit Cengiz Topel Caddesi', houseNumber: '36', locality: 'Bostanlı', region: 'Karşıyaka', province: 'İzmir', postalCode: '35590' },
  { street: 'İsmet Paşa Caddesi', houseNumber: '38', locality: 'Çay', region: 'Gökçebey', province: 'Zonguldak', postalCode: '67670' },
  { street: 'Atatürk Caddesi', houseNumber: '25', locality: 'Yusufpaşa', region: 'Kars Merkez', province: 'Kars', postalCode: '36100' },
  { street: 'Kurtalan Yolu Caddesi', houseNumber: '132', locality: 'Kooperatif', region: 'Siirt Merkez', province: 'Siirt', postalCode: '56100' },
  { street: 'İnönü Caddesi', houseNumber: '97', locality: 'Gülabibey', region: 'Çorum Merkez', province: 'Çorum', postalCode: '19100' },
];

const ukraineAddresses = [
  { street: 'вул. Хрещатик', houseNumber: '15', locality: 'Київ', region: 'Київська', province: 'Київ', postalCode: '01001' },
  { street: 'вул. Дерибасівська', houseNumber: '8', locality: 'Одеса', region: 'Одеська', province: 'Одеса', postalCode: '65026' },
  { street: 'просп. Свободи', houseNumber: '25', locality: 'Львів', region: 'Львівська', province: 'Львів', postalCode: '79000' },
  { street: 'вул. Сумська', houseNumber: '35', locality: 'Харків', region: 'Харківська', province: 'Харків', postalCode: '61000' },
  { street: 'вул. Центральна', houseNumber: '42', locality: 'Дніпро', region: 'Дніпропетровська', province: 'Дніпро', postalCode: '49000' },
  { street: 'вул. Головна', houseNumber: '12', locality: 'Вінниця', region: 'Вінницька', province: 'Вінниця', postalCode: '21000' },
  { street: 'просп. Миру', houseNumber: '78', locality: 'Запоріжжя', region: 'Запорізька', province: 'Запоріжжя', postalCode: '69000' },
  { street: 'вул. Незалежності', houseNumber: '5', locality: 'Івано-Франківськ', region: 'Івано-Франківська', province: 'Івано-Франківськ', postalCode: '76000' },
  { street: 'вул. Шевченка', houseNumber: '22', locality: 'Тернопіль', region: 'Тернопільська', province: 'Тернопіль', postalCode: '46000' },
  { street: 'вул. Грушевського', houseNumber: '18', locality: 'Ужгород', region: 'Закарпатська', province: 'Ужгород', postalCode: '88000' },
];

// Generate random date of birth in DD-MM-YYYY format
const generateRandomBirthDate = (): string => {
  const startDate = new Date(1970, 0, 1);
  const endDate = new Date(2000, 11, 31);
  const randomDate = new Date(startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime()));
  
  const day = String(randomDate.getDate()).padStart(2, '0');
  const month = String(randomDate.getMonth() + 1).padStart(2, '0');
  const year = randomDate.getFullYear();
  
  return `${day}-${month}-${year}`;
};

// Generate random person data
const generateRandomPersonData = (country: string): PersonData => {
  let firstName: string;
  let lastName: string;
  let address: typeof turkeyAddresses[0];
  
  if (country === 'Turkey') {
    firstName = turkishFirstNames[Math.floor(Math.random() * turkishFirstNames.length)];
    lastName = turkishLastNames[Math.floor(Math.random() * turkishLastNames.length)];
    address = turkeyAddresses[Math.floor(Math.random() * turkeyAddresses.length)];
  } else {
    firstName = ukrainianFirstNames[Math.floor(Math.random() * ukrainianFirstNames.length)];
    lastName = ukrainianLastNames[Math.floor(Math.random() * ukrainianLastNames.length)];
    address = ukraineAddresses[Math.floor(Math.random() * ukraineAddresses.length)];
  }
  
  return {
    first_name: firstName,
    last_name: lastName,
    birth_date: generateRandomBirthDate(),
    country: country,
    city: address.locality,
    address: `${address.street} ${address.houseNumber}`,
    zip: address.postalCode,
  };
};

// Check if person data is complete
const isPersonDataComplete = (person?: BotWithPerson['person']): boolean => {
  if (!person) return false;
  return !!(
    person.first_name?.trim() &&
    person.last_name?.trim() &&
    person.birth_date?.trim() &&
    person.country?.trim() &&
    person.city?.trim() &&
    person.address?.trim() &&
    person.zip?.trim()
  );
};

export const BotPerson: React.FC<BotPersonProps> = ({ bot }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<string>('Turkey');

  // Initialize form with bot data
  useEffect(() => {
    console.log('BotPerson useEffect - bot data:', bot);
    console.log('BotPerson useEffect - bot.person:', bot?.person);
    console.log('BotPerson useEffect - bot keys:', Object.keys(bot || {}));
    
    // Access person data directly from bot object
    const personData = bot?.person;
    console.log('BotPerson useEffect - personData:', personData);
    
    if (personData) {
      // Check if person data has any actual values
      const values = Object.values(personData);
      console.log('BotPerson useEffect - person values:', values);
      const hasAnyData = values.some(value => value && typeof value === 'string' && value.trim() !== '');
      console.log('BotPerson useEffect - hasAnyData:', hasAnyData);
      
      if (hasAnyData) {
        console.log('Setting form values from personData:', personData);
        form.setFieldsValue({
          first_name: personData.first_name || '',
          last_name: personData.last_name || '',
          birth_date: personData.birth_date || '',
          country: personData.country || '',
          city: personData.city || '',
          address: personData.address || '',
          zip: personData.zip || '',
        });
        if (personData.country) {
          setSelectedCountry(personData.country);
        }
      } else {
        console.log('Person object exists but is empty, resetting form');
        form.resetFields();
      }
    } else {
      console.log('No person data in bot, resetting form');
      form.resetFields();
    }
    setLoading(false);
  }, [bot, form]);

  const handleSave = async (values: Record<string, string>) => {
    if (!bot?.id) {
      message.error('Bot ID is not available');
      return;
    }

    setSaving(true);
    try {
      // Save to Firebase using set instead of update to ensure all fields are written
      const personRef = ref(database, `bots/${bot.id}/person`);
      const personData = {
        first_name: values.first_name || '',
        last_name: values.last_name || '',
        birth_date: values.birth_date || '',
        country: values.country || '',
        city: values.city || '',
        address: values.address || '',
        zip: values.zip || '',
      };
      console.log('Saving person data to Firebase:', personData);
      await update(personRef, personData);
      console.log('Person data saved successfully to Firebase');
      message.success('Person data saved successfully');
    } catch (error) {
      console.error('Error saving person data:', error);
      message.error('Failed to save person data: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateData = useCallback(() => {
    const generatedData = generateRandomPersonData(selectedCountry);
    form.setFieldsValue(generatedData);
    message.success(`Generated random person data for ${selectedCountry}`);
  }, [selectedCountry, form]);

  // Show warning if data is incomplete
  const hasIncompleteData = !isPersonDataComplete(bot?.person);

  if (!bot) {
    return (
      <div className="bot-person">
        <Alert
          message="Error"
          description="Bot data is not available"
          type="error"
          showIcon
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bot-person">
        <Card title="Person Information" className="person-card">
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Spin size="large" />
            <p style={{ marginTop: '16px', color: 'var(--proxmox-text-secondary)' }}>
              Loading person data...
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="bot-person">
      <Card 
        title={
          <div className="person-card-header">
            <span>Person Information</span>
            {hasIncompleteData && (
              <Tooltip title="Some fields are empty. Please fill in all person data.">
                <Badge 
                  dot 
                  color="orange"
                  className="incomplete-badge"
                >
                  <ExclamationCircleOutlined className="warning-icon" />
                </Badge>
              </Tooltip>
            )}
          </div>
        } 
        className="person-card"
      >
        {hasIncompleteData && (
          <Alert
            message="Incomplete Person Data"
            description="Some fields are empty. Please fill in all person data or use the Generate button to create random data."
            type="warning"
            showIcon
            icon={<ExclamationCircleOutlined />}
            style={{ marginBottom: '16px' }}
          />
        )}

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          className="person-form"
          autoComplete="off"
        >
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item
                label={
                  <span className="field-label">
                    First Name
                    {!form.getFieldValue('first_name') && (
                      <ExclamationCircleOutlined className="field-warning-icon" />
                    )}
                  </span>
                }
                name="first_name"
              >
                <Input placeholder="Enter first name" autoComplete="off" />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} md={8}>
              <Form.Item
                label={
                  <span className="field-label">
                    Last Name
                    {!form.getFieldValue('last_name') && (
                      <ExclamationCircleOutlined className="field-warning-icon" />
                    )}
                  </span>
                }
                name="last_name"
              >
                <Input placeholder="Enter last name" autoComplete="off" />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} md={8}>
              <Form.Item
                label={
                  <span className="field-label">
                    Birth Date
                    {!form.getFieldValue('birth_date') && (
                      <ExclamationCircleOutlined className="field-warning-icon" />
                    )}
                  </span>
                }
                name="birth_date"
              >
                <Input placeholder="DD-MM-YYYY" autoComplete="off" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item
                label={
                  <span className="field-label">
                    Country
                    {!form.getFieldValue('country') && (
                      <ExclamationCircleOutlined className="field-warning-icon" />
                    )}
                  </span>
                }
                name="country"
              >
                <Select 
                  placeholder="Select country"
                  onChange={(value) => setSelectedCountry(value)}
                >
                  {countries.map(country => (
                    <Option key={country} value={country}>{country}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} md={8}>
              <Form.Item
                label={
                  <span className="field-label">
                    City
                    {!form.getFieldValue('city') && (
                      <ExclamationCircleOutlined className="field-warning-icon" />
                    )}
                  </span>
                }
                name="city"
              >
                <Input placeholder="Enter city" autoComplete="off" />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} md={8}>
              <Form.Item
                label={
                  <span className="field-label">
                    ZIP Code
                    {!form.getFieldValue('zip') && (
                      <ExclamationCircleOutlined className="field-warning-icon" />
                    )}
                  </span>
                }
                name="zip"
              >
                <Input placeholder="Enter ZIP code" autoComplete="off" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={16}>
              <Form.Item
                label={
                  <span className="field-label">
                    Address
                    {!form.getFieldValue('address') && (
                      <ExclamationCircleOutlined className="field-warning-icon" />
                    )}
                  </span>
                }
                name="address"
              >
                <Input placeholder="Enter full address (street, house number)" autoComplete="off" />
              </Form.Item>
            </Col>
          </Row>

          <div className="person-form-actions">
            <div className="generate-section">
              <span className="generate-label">Generate random data for:</span>
              <Select
                value={selectedCountry}
                onChange={setSelectedCountry}
                className="country-select"
                style={{ width: 120 }}
              >
                {countries.map(country => (
                  <Option key={country} value={country}>{country}</Option>
                ))}
              </Select>
              <Button 
                type="default" 
                icon={<ThunderboltOutlined />}
                onClick={handleGenerateData}
                className="generate-btn"
              >
                Generate Data
              </Button>
            </div>

            <Button 
              type="primary" 
              htmlType="submit" 
              icon={<SaveOutlined />}
              loading={saving}
              className="save-btn"
            >
              Save Changes
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
};
