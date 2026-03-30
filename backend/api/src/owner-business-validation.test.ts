import 'reflect-metadata';
import assert from 'node:assert/strict';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, it } from 'vitest';
import { UpdateOwnerBusinessDto } from './modules/businesses/dto/update-owner-business.dto';

function flattenValidationConstraints(errors: Awaited<ReturnType<typeof validate>>) {
  const messages = [] as string[];

  for (const error of errors) {
    if (error.constraints) {
      messages.push(...Object.values(error.constraints));
    }

    if (error.children?.length) {
      messages.push(...flattenValidationConstraints(error.children));
    }
  }

  return messages;
}

describe('Owner business validation', () => {
  it('requires service name, description, and a positive price', async () => {
    const dto = plainToInstance(UpdateOwnerBusinessDto, {
      services: [
        {
          name: '',
          description: '',
          durationMinutes: 60,
          price: 0,
          isActive: true,
        },
      ],
    });

    const errors = await validate(dto);
    const messages = flattenValidationConstraints(errors);

    assert.ok(messages.includes('name should not be empty'));
    assert.ok(messages.includes('description should not be empty'));
    assert.ok(messages.includes('price must not be less than 1'));
  });

  it('accepts a service with name, description, and price', async () => {
    const dto = plainToInstance(UpdateOwnerBusinessDto, {
      services: [
        {
          name: 'Gel Manicure',
          description: 'Cuticle care, shape, and glossy gel color.',
          durationMinutes: 60,
          price: 55.5,
          isActive: true,
        },
      ],
    });

    const errors = await validate(dto);

    assert.equal(flattenValidationConstraints(errors).length, 0);
  });
});
