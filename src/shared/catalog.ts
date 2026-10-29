/*
  Built-in catalogue for the Find dropdowns. Settings → Verticals and Region
  are Zak's current focus and always appear first; this adds the wider set of
  owner-run, high-ticket NZ trades worth prospecting, so a new search is a pick
  rather than a type.
*/

export interface CatalogGroup { group: string; items: string[] }

export const CATEGORY_CATALOG: CatalogGroup[] = [
  { group: 'Marine', items: [
    'Boat builders', 'Aluminium boat builders', 'Boat dealers', 'Yacht brokers', 'Marine engineers', 'Outboard sales and servicing',
    'Boat trailers', 'Marine upholstery and canvas', 'Antifouling and haul-out yards', 'Marine electronics', 'Boat storage and stacking',
    'Fishing charters', 'Superyacht services', 'Jet boat builders'
  ] },
  { group: 'Pools and outdoor living', items: [
    'Pool builders', 'Pool and spa retailers', 'Spa and hot tub dealers', 'Landscape architects', 'Landscapers and hardscaping',
    'Outdoor kitchens', 'Pergolas and louvre roofs', 'Decking builders', 'Fencing and pool fencing', 'Artificial turf installers'
  ] },
  { group: 'Motorhomes and caravans', items: [
    'Motorhome dealers', 'Caravan dealers', 'Campervan conversions', 'Motorhome rentals', 'RV servicing and repairs', 'Horse floats and trailers'
  ] },
  { group: 'Luxury homes', items: [
    'Luxury home builders', 'Architectural builders', 'Architects', 'Kitchen manufacturers', 'Joinery', 'Interior designers',
    'Home automation and AV', 'Solar and batteries', 'Window and door joinery', 'Staircases and balustrades', 'Flooring specialists',
    'Bathroom renovators', 'Relocatable and transportable homes', 'Tiny homes'
  ] },
  { group: 'Seasonal leisure and venues', items: [
    'Jet ski hire', 'Boat hire', 'Kayak and paddleboard hire', 'Wedding venues', 'Event venues', 'Function centres', 'Glamping',
    'Golf courses', 'E-bike hire and tours', 'Adventure tourism', 'Ski and snow hire', 'Vineyards with cellar doors'
  ] },
  { group: 'Vehicles and machinery', items: [
    'Classic car restorers', 'Prestige car dealers', 'Motorcycle dealers', 'Tractor and farm machinery dealers', 'Ride-on mower dealers',
    'Trailer manufacturers', 'Truck and ute accessories'
  ] },
  { group: 'Asking for help online', items: [
    'Businesses asking for a web designer', 'Businesses asking for marketing help', 'Businesses with no website', 'New businesses (registered this year)'
  ] }
]

export const AREA_CATALOG: CatalogGroup[] = [
  { group: 'North Shore', items: ['North Shore', 'Albany', 'Takapuna', 'Devonport', 'Glenfield', 'Wairau Valley', 'Browns Bay', 'Mairangi Bay', 'Milford', 'Northcote', 'Birkenhead', 'Rosedale'] },
  { group: 'Hibiscus Coast and Rodney', items: ['Hibiscus Coast', 'Orewa', 'Silverdale', 'Whangaparāoa', 'Gulf Harbour', 'Red Beach', 'Millwater', 'Warkworth', 'Matakana', 'Snells Beach', 'Wellsford', 'Helensville', 'Kumeū', 'Riverhead'] },
  { group: 'West Auckland', items: ['West Auckland', 'Henderson', 'New Lynn', 'Te Atatū', 'Massey', 'Westgate', 'Hobsonville', 'Swanson', 'Kelston', 'Titirangi'] },
  { group: 'Central and East Auckland', items: ['Central Auckland', 'Westhaven', 'Ponsonby', 'Grey Lynn', 'Mt Wellington', 'Penrose', 'East Tāmaki', 'Howick', 'Pakuranga', 'Half Moon Bay', 'Beachlands', 'Botany'] },
  { group: 'South Auckland', items: ['South Auckland', 'Manukau', 'Takanini', 'Papakura', 'Drury', 'Pukekohe', 'Karaka', 'Clevedon'] },
  { group: 'Upper North Island', items: ['Whangārei', 'Bay of Islands', 'Kerikeri', 'Hamilton', 'Coromandel', 'Whitianga', 'Tauranga', 'Mount Maunganui', 'Rotorua', 'Taupō'] },
  { group: 'Lower North Island', items: ['Gisborne', 'Napier', 'Hastings', 'New Plymouth', 'Whanganui', 'Palmerston North', 'Kāpiti Coast', 'Wellington', 'Wairarapa'] },
  { group: 'South Island', items: ['Nelson', 'Marlborough', 'Blenheim', 'Christchurch', 'Kaikōura', 'Timaru', 'Wānaka', 'Queenstown', 'Dunedin', 'Invercargill'] }
]

