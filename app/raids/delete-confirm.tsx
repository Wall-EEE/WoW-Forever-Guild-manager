'use client';
import { useRef } from 'react';
import { deleteRaid } from './actions';

export default function DeleteRaidConfirm({id,title,signups}:{id:string;title:string;signups:number}) {
  const dialog = useRef<HTMLDialogElement>(null);
  return <div className="raid-delete-wrap">
    <button className="raid-delete-trigger" type="button" onClick={()=>dialog.current?.showModal()}>Delete raid</button>
    <dialog className="raid-delete-dialog" ref={dialog} onClick={e=>{if(e.target===dialog.current)dialog.current.close();}}>
      <h3>Delete {title}?</h3>
      <p>This will permanently delete the raid and remove {signups} {signups===1?'signup':'signups'}. This cannot be undone.</p>
      <div className="raid-delete-buttons">
        <button type="button" className="raid-button raid-muted" onClick={()=>dialog.current?.close()}>Cancel</button>
        <form action={deleteRaid}><input name="raid_id" type="hidden" value={id}/><button type="submit" className="raid-button raid-confirm-danger">Yes, delete raid</button></form>
      </div>
    </dialog>
  </div>;
}
