import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { queryRows } from '@/lib/db'

export async function PATCH(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    if (session.role !== 'manager') return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

    const { id, name, sku, uom, category, reorder_qty } = await req.json()
    if (!id) return NextResponse.json({ error: 'Product ID required.' }, { status: 400 })

    let categoryId: number | undefined
    if (category?.trim()) {
      const { rows } = await queryRows(
        `INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
        [category.trim()]
      )
      categoryId = (rows[0] as Record<string,unknown>).id as number
    }

    const updates: string[] = []
    const params: (string | number | null)[] = []
    let i = 1

    if (name)        { updates.push(`name = $${i++}`);        params.push(name.trim())  }
    if (sku)         { updates.push(`sku = $${i++}`);         params.push(sku.trim())   }
    if (uom)         { updates.push(`uom = $${i++}`);         params.push(uom.trim())   }
    if (categoryId)  { updates.push(`category_id = $${i++}`); params.push(categoryId)   }
    if (reorder_qty !== undefined) { updates.push(`reorder_qty = $${i++}`); params.push(Number(reorder_qty)) }

    if (updates.length === 0) return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 })

    params.push(Number(id))
    const { rows } = await queryRows(
      `UPDATE products SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
      params
    )

    return NextResponse.json({ product: rows[0] })
  } catch (err) {
    console.error('[product/update PATCH]', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
