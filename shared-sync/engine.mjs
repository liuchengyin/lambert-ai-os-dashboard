export async function pullWorkspace(client,journal){
  const rows=[];const size=500;
  for(let start=0;;start+=size){const {data,error}=await client.from('lambert_items').select('*').order('kind').order('item_id').range(start,start+size-1);if(error)throw error;if(!Array.isArray(data))throw Error('invalid_cloud_data');rows.push(...data);if(data.length<size)break;}
  journal.mergeRemote(rows);return rows;
}
export async function synchronize(client,journal){
  const {data,error}=await client.auth.getUser();if(error)throw error;if(data?.user?.id!==journal.userId)throw Error('account_mismatch');
  const blocked=new Set(journal.conflicts().map(o=>JSON.stringify([o.kind,o.itemId])));
  for(const batch of journal.batches())for(const op of batch.ops){
    const key=JSON.stringify([op.kind,op.itemId]);if(op.conflict||blocked.has(key))continue;
    const {data:response,error:failure}=await client.rpc('lambert_apply_mutation',{p_mutation_id:op.mutationId,p_kind:op.kind,p_item_id:op.itemId,p_payload:op.payload,p_expected_version:op.expectedVersion,p_deleted:op.deleted});
    if(failure)throw failure;
    if(response.status==='conflict')blocked.add(key);
    journal.acknowledge(batch.key,op.mutationId,response);
  }
  await pullWorkspace(client,journal);
  return {pending:journal.pending().length,conflicts:journal.conflicts().length};
}
