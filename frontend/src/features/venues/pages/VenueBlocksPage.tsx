import { useEffect, useState } from 'react'
import { Card } from '../../../components/ui/Card'
import { Field } from '../../../components/ui/FormControls'
import { useCurrentUser } from '../../auth/sessionContext'
import { VenueBlockForm } from '../components/VenueBlockForm'
import { VenueBlockList } from '../components/VenueBlockList'
import {
  createVenueBlock, listBlockableVenues, listVenueBlocks, previewVenueBlock, removeVenueBlock,
} from '../venueBlockService'
import type { BlockableVenue, VenueBlock } from '../venueBlockTypes'

const selectClasses =
  'block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 ' +
  'focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500'

/** US12: Venue Staff pick a venue, block slots on it, and see and remove its current blocks. */
export function VenueBlocksPage() {
  const { profile, loading } = useCurrentUser()
  const isVenueStaff = profile?.role === 'venue_staff'

  const [venues, setVenues] = useState<BlockableVenue[]>([])
  const [venueId, setVenueId] = useState('')
  const [blocks, setBlocks] = useState<VenueBlock[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isVenueStaff) return
    void listBlockableVenues().then((result) => {
      if (result.ok) setVenues(result.value)
      else setError(result.reason)
    })
  }, [isVenueStaff])

  async function loadBlocks(id: string) {
    const result = await listVenueBlocks(id)
    if (result.ok) {
      setBlocks(result.value)
      setError(null)
    } else {
      setBlocks([])
      setError(result.reason)
    }
  }

  function chooseVenue(id: string) {
    setVenueId(id)
    setBlocks([])
    if (id) void loadBlocks(id)
  }

  if (loading) return null

  if (!isVenueStaff) {
    return (
      <Card title="Venue blocks">
        <p className="text-sm text-slate-600">Blocking venues is available to Venue Staff.</p>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card title="Venue blocks">
        <div className="space-y-3">
          <Field id="block-venue" label="Venue">
            <select
              id="block-venue"
              className={selectClasses}
              value={venueId}
              onChange={(event) => chooseVenue(event.target.value)}
            >
              <option value="">Choose a venue</option>
              {venues.map((venue) => (
                <option key={venue.id} value={venue.id}>
                  {venue.location ? `${venue.name} — ${venue.location}` : venue.name}
                </option>
              ))}
            </select>
          </Field>
          {error && (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          )}
        </div>
      </Card>

      {venueId && (
        <>
          <Card title="Block slots">
            <VenueBlockForm
              key={venueId}
              venueId={venueId}
              onPreview={previewVenueBlock}
              onCreate={createVenueBlock}
              onSaved={() => void loadBlocks(venueId)}
            />
          </Card>
          <Card title="Current blocks">
            <VenueBlockList
              blocks={blocks}
              onRemove={removeVenueBlock}
              onRemoved={() => void loadBlocks(venueId)}
            />
          </Card>
        </>
      )}
    </div>
  )
}
