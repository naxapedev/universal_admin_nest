import { Controller, Get, Post, Body, Patch, Param, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RegisterProductDto } from './dto/register-product.dto';
import { UpdateVerificationMethodDto } from './dto/update-verification.dto';

@Controller('server1/api/v1/products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @Roles('developer')
  async registerProduct(@Body() dto: RegisterProductDto) {
    return this.productsService.registerProduct(dto);
  }

  @Get()
  @Roles('developer', 'superadmin')
  async getAllProducts() {
    return this.productsService.getAllProducts();
  }

  @Get(':id')
  @Roles('developer')
  async getProductById(@Param('id') id: string) {
    return this.productsService.getProductById(id);
  }

  @Get('by-product-id/:productId')
  async getProductByProductId(@Param('productId') productId: string) {
    return this.productsService.getProductByProductId(productId);
  }

  @Get('by-product-id/:productId/users')
  async getProductUsersByProductId(@Param('productId') productId: string) {
    return this.productsService.getProductUsersByProductId(productId);
  }

  @Patch(':id/verification-method')
  @Roles('superadmin')
  async updateProductVerificationMethod(
    @Param('id') id: string,
    @Body() dto: UpdateVerificationMethodDto,
  ) {
    return this.productsService.updateProductVerificationMethod(id, dto.verification_method);
  }
}