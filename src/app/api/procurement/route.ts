import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const type = url.searchParams.get('type') || 'all';
    const projectId = url.searchParams.get('projectId');

    if (type === 'requests') {
      const requests = await prisma.materialRequest.findMany({
        where: projectId ? { projectId } : undefined,
        orderBy: { createdAt: 'desc' },
        include: {
          requestedBy: { select: { name: true } },
          approvedBy: { select: { name: true } },
          supplier: { select: { name: true } },
        },
      });
      return NextResponse.json(requests);
    }

    if (type === 'stock') {
      const stock = await prisma.stockItem.findMany({
        where: projectId ? { projectId } : undefined,
        orderBy: { itemName: 'asc' },
      });
      return NextResponse.json(stock);
    }

    if (type === 'suppliers') {
      const suppliers = await prisma.supplier.findMany({
        orderBy: { name: 'asc' },
      });
      return NextResponse.json(suppliers);
    }

    // Default: return all grouped
    const [requests, stock, suppliers] = await Promise.all([
      prisma.materialRequest.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          requestedBy: { select: { name: true } },
          approvedBy: { select: { name: true } },
          supplier: { select: { name: true } },
        },
      }),
      prisma.stockItem.findMany({
        orderBy: { itemName: 'asc' },
      }),
      prisma.supplier.findMany({
        orderBy: { name: 'asc' },
      }),
    ]);

    return NextResponse.json({ requests, stock, suppliers });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'create_request') {
      const { itemName, quantity, unit, requestedById, projectId, supplierId } = body;
      const request = await prisma.materialRequest.create({
        data: {
          itemName,
          quantity: parseFloat(quantity),
          unit,
          status: 'REQUESTED',
          requestedById,
          projectId,
          supplierId: supplierId || null,
        },
      });
      return NextResponse.json(request);
    }

    if (action === 'create_supplier') {
      const { name, phone, materialsSupplied } = body;
      const supplier = await prisma.supplier.create({
        data: { name, phone, materialsSupplied },
      });
      return NextResponse.json(supplier);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'update_request_status') {
      const { id, status, approvedById } = body;

      const current = await prisma.materialRequest.findUnique({
        where: { id },
      });
      if (!current) return NextResponse.json({ error: 'Request not found' }, { status: 404 });

      const updated = await prisma.materialRequest.update({
        where: { id },
        data: {
          status,
          approvedById: approvedById || current.approvedById,
        },
      });

      // If status changed to RECEIVED, auto-add to StockItem!
      if (status === 'RECEIVED') {
        const existingStock = await prisma.stockItem.findFirst({
          where: { projectId: current.projectId, itemName: current.itemName },
        });

        if (existingStock) {
          await prisma.stockItem.update({
            where: { id: existingStock.id },
            data: { quantityOnHand: existingStock.quantityOnHand + current.quantity },
          });
        } else {
          await prisma.stockItem.create({
            data: {
              projectId: current.projectId,
              itemName: current.itemName,
              quantityOnHand: current.quantity,
              unit: current.unit,
            },
          });
        }
      }

      return NextResponse.json(updated);
    }

    if (action === 'use_stock_item') {
      const { id, quantityToUse } = body;
      const stock = await prisma.stockItem.findUnique({ where: { id } });
      if (!stock) return NextResponse.json({ error: 'Stock item not found' }, { status: 404 });

      const nextQty = Math.max(0, stock.quantityOnHand - parseFloat(quantityToUse));
      const updated = await prisma.stockItem.update({
        where: { id },
        data: { quantityOnHand: nextQty },
      });
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
