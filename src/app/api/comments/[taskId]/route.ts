import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const supabase = await createClient()
  const { taskId } = await params
  const { data, error } = await supabase
    .from('comments')
    .select('*, profiles(full_name, username)')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}