import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import { ArchitectureType, DbDriver, VerificationMethod, VisaStatus } from '@prisma/client';
import { RegisterProductDto } from './dto/register-product.dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  private generateRSAKeyPair() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });
    return { publicKey, privateKey };
  }

  async registerProduct(dto: RegisterProductDto) {
    const { publicKey, privateKey } = this.generateRSAKeyPair();

    try {
      const product = await this.prisma.productRegistry.create({
        data: {
          name: dto.name,
          architecture_type: dto.architecture_type,
          db_driver: dto.db_driver,
          db_uri: dto.db_uri,
          app_public_key: publicKey,
          app_private_key: privateKey,
          ui_schema: dto.ui_schema || [],
        },
      });

      const { app_private_key, id, server_api_key, ...rest } = product;
      return {
        status: true,
        message: 'Product registered successfully',
        data: {
          _id: id,
          server_api_key,
          ...rest
        },
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async getAllProducts() {
    const products = await this.prisma.productRegistry.findMany({
      select: {
        id: true,
        product_id: true,
        name: true,
        architecture_type: true,
        db_driver: true,
        db_uri: true,
        app_public_key: true,
        verification_method: true,
        frontend_url: true,
        ui_schema: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const mappedProducts = products.map(({ id, ...rest }) => ({
      _id: id,
      ...rest
    }));

    return {
      status: true,
      message: 'Products fetched successfully',
      data: mappedProducts,
    };
  }

  async getProductById(id: string) {
    const product = await this.prisma.productRegistry.findUnique({
      where: { id },
      select: {
        id: true,
        product_id: true,
        name: true,
        architecture_type: true,
        db_driver: true,
        db_uri: true,
        app_public_key: true,
        verification_method: true,
        frontend_url: true,
        ui_schema: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const { id: pid, ...rest } = product;
    return {
      status: true,
      message: 'Product fetched successfully',
      data: {
        _id: pid,
        ...rest
      },
    };
  }

  async getProductByProductId(productId: string) {
    const product = await this.prisma.productRegistry.findUnique({
      where: { product_id: productId },
      select: {
        product_id: true,
        name: true,
        app_public_key: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async getProductUsersByProductId(productId: string) {
    const product = await this.prisma.productRegistry.findUnique({
      where: { product_id: productId },
      select: { product_id: true, name: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const visas = await this.prisma.visa.findMany({
      where: { productId: product.product_id, status: VisaStatus.Active },
    });

    if (!visas.length) {
      return [];
    }

    const userIds = visas.map((v) => v.globalUserId);
    const users = await this.prisma.globalUser.findMany({
      where: { global_user_id: { in: userIds } },
      select: { global_user_id: true, email: true, username: true },
    });

    const userMap = new Map(users.map((u) => [u.global_user_id, u]));

    return visas.map((visa) => {
      const user = userMap.get(visa.globalUserId);
      return {
        global_user_id: visa.globalUserId,
        email: user?.email || '',
        username: user?.username || '',
        role: visa.role,
        status: visa.status,
      };
    });
  }

  async updateProductVerificationMethod(id: string, verification_method: VerificationMethod) {
    try {
      const product = await this.prisma.productRegistry.update({
        where: { id },
        data: { verification_method },
        select: {
          id: true,
          product_id: true,
          name: true,
          architecture_type: true,
          db_driver: true,
          db_uri: true,
          app_public_key: true,
          verification_method: true,
          frontend_url: true,
          ui_schema: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const { id: pid, ...rest } = product;

      return {
        status: true,
        message: `Verification method updated to '${verification_method}'`,
        data: {
          _id: pid,
          ...rest
        },
      };
    } catch (error) {
      throw new NotFoundException('Product not found');
    }
  }
}
