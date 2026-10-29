/*
  Built-in catalogue for the Find dropdowns. Settings → Verticals and Region
  are Zak's current focus and always appear first; this adds the wider set of
  owner-run, high-ticket NZ businesses worth prospecting, and every suburb and
  locality in the Auckland region, so a new search is a pick rather than a type.
*/

export interface CatalogGroup { group: string; items: string[] }

export const CATEGORY_CATALOG: CatalogGroup[] = [
  { group: 'Marine', items: [
    'Boat builders', 'Aluminium boat builders', 'Fibreglass boat builders', 'Jet boat builders', 'Boat dealers', 'Used boat dealers',
    'Yacht brokers', 'Marine engineers', 'Outboard sales and servicing', 'Inboard and sterndrive servicing', 'Boat trailers',
    'Marine upholstery and canvas', 'Antifouling and haul-out yards', 'Marine electronics', 'Marine electricians', 'Boat storage and stacking',
    'Marinas and berths', 'Boat detailing and wrapping', 'Rigging and sails', 'Fishing charters', 'Dive charters and dive shops',
    'Superyacht services', 'Marine fabrication', 'Jet ski dealers', 'Kayak and fishing kayak retailers', 'Boating schools and skipper courses'
  ] },
  { group: 'Pools and outdoor living', items: [
    'Pool builders', 'Fibreglass pool installers', 'Pool and spa retailers', 'Spa and hot tub dealers', 'Swim spa dealers', 'Saunas and cold plunges',
    'Pool fencing and glass balustrades', 'Pool heating and covers', 'Landscape architects', 'Landscapers and hardscaping', 'Outdoor kitchens',
    'Pergolas and louvre roofs', 'Decking builders', 'Fencing contractors', 'Artificial turf installers', 'Retaining walls',
    'Garden lighting', 'Outdoor furniture retailers', 'Fire pits and outdoor heaters', 'Irrigation specialists'
  ] },
  { group: 'Motorhomes, caravans and trailers', items: [
    'Motorhome dealers', 'Caravan dealers', 'Campervan conversions', 'Motorhome rentals', 'RV servicing and repairs', 'Self-containment certifiers',
    'Horse floats and trailers', 'Trailer manufacturers', 'Off-road and overland vehicle fit-outs', 'Rooftop tent and 4x4 accessory retailers'
  ] },
  { group: 'Luxury homes and building', items: [
    'Luxury home builders', 'Architectural builders', 'Group home builders', 'Architects', 'Architectural designers', 'Kitchen manufacturers',
    'Joinery', 'Interior designers', 'Home automation and AV', 'Home cinema installers', 'Solar and batteries', 'EV charger installers',
    'Window and door joinery', 'Staircases and balustrades', 'Flooring specialists', 'Bathroom renovators', 'Renovation specialists',
    'Relocatable and transportable homes', 'Tiny homes', 'Modular and prefab homes', 'Roofing contractors', 'Cladding specialists',
    'Concrete and polished floors', 'Steel and glass fabricators', 'Wine cellars', 'Smart lighting designers', 'Home elevators and lifts'
  ] },
  { group: 'Seasonal leisure and tourism', items: [
    'Jet ski hire', 'Boat hire', 'Kayak and paddleboard hire', 'E-bike hire and tours', 'Glamping', 'Holiday parks', 'Luxury lodges',
    'Adventure tourism', 'Helicopter tours', 'Scenic flights', 'Ski and snow hire', 'Surf schools', 'Fishing guides', 'Horse trekking',
    'Golf courses', 'Mini golf and family attractions', 'Escape rooms', 'Go-karting', 'Clay shooting', 'Hot pools and day spas'
  ] },
  { group: 'Venues and events', items: [
    'Wedding venues', 'Event venues', 'Function centres', 'Vineyards with cellar doors', 'Breweries and distilleries with tasting rooms',
    'Conference venues', 'Marquee and event hire', 'Wedding planners', 'Wedding photographers and videographers', 'Event caterers',
    'Party and corporate boat cruises', 'Private dining rooms'
  ] },
  { group: 'Vehicles and machinery', items: [
    'Classic car restorers', 'Prestige car dealers', 'Used car dealers', 'Motorcycle dealers', 'E-bike and e-scooter retailers',
    'Tractor and farm machinery dealers', 'Ride-on mower dealers', 'Golf cart dealers', 'Truck and ute accessories', 'Vehicle wrapping and paint protection',
    'Car detailing and ceramic coating', 'Performance and tuning workshops', 'Electric vehicle specialists', 'Plant and machinery hire'
  ] },
  { group: 'High-ticket retail', items: [
    'Furniture stores', 'Bed and mattress specialists', 'Jewellers', 'Watch dealers', 'Bridal boutiques', 'Bespoke tailors',
    'Piano and musical instrument dealers', 'Lighting showrooms', 'Rug and carpet specialists', 'Art galleries', 'Appliance specialists',
    'Barbecue and outdoor cooking retailers', 'Gun shops and hunting retailers', 'Golf equipment and fitting', 'Bike shops (high-end)'
  ] },
  { group: 'Health, beauty and wellness', items: [
    'Cosmetic clinics', 'Laser and skin clinics', 'Dental implant clinics', 'Orthodontists', 'Cosmetic dentists', 'Plastic surgeons',
    'Hair transplant clinics', 'Private physiotherapy', 'Boutique gyms and studios', 'Pilates studios', 'Day spas', 'Optometrists (independent)',
    'Hearing clinics', 'Vets (independent practices)'
  ] },
  { group: 'Rural and lifestyle', items: [
    'Lifestyle block services', 'Fencing and farm contractors', 'Equestrian centres', 'Saddlery and horse gear', 'Dog breeders and kennels',
    'Orchards with farm gates', 'Firewood and outdoor fuel', 'Water tanks and bores', 'Septic and wastewater systems', 'Shed and barn builders'
  ] },
  { group: 'Education and services', items: [
    'Private tutoring centres', 'Driving schools', 'Flight schools', 'Music schools', 'Swim schools', 'Childcare (privately owned)',
    'Boutique real estate agencies', 'Mortgage advisers', 'Funeral directors (independent)', 'Self storage'
  ] },
  { group: 'Startups and tech', items: [
    'Agritech startups', 'Aquaculture and seafood tech', 'Food tech and alt-protein', 'Climate tech and cleantech', 'Energy and battery startups',
    'SaaS startups', 'Fintech startups', 'Healthtech and medtech', 'Biotech', 'Edtech', 'Proptech and construction tech', 'Marine tech',
    'Drone and aerospace', 'Space tech', 'Robotics and automation', 'Hardware and IoT', 'Game studios', 'AI startups', 'Cybersecurity',
    'Direct-to-consumer brands', 'E-commerce brands', 'Crowdfunded startups (PledgeMe, Snowball)', 'Incubator and accelerator cohorts',
    'Recently funded startups', 'Tech exporters'
  ] },
  { group: 'Primary industries', items: [
    'Seafood and fishing companies', 'Aquaculture (mussels, salmon, oysters)', 'Forestry contractors', 'Sawmills and wood processors',
    'Kiwifruit growers and packhouses', 'Apple and pipfruit orchards', 'Avocado growers', 'Berry farms', 'Market gardens and vegetable growers',
    'Vineyards and wineries', 'Dairy farms and processors', 'Meat processors and butchers', 'Honey and mānuka producers', 'Deer and venison farms',
    'Wool and fibre producers', 'Nurseries and plant growers', 'Agricultural contractors', 'Rural merchandise stores', 'Grain and feed suppliers',
    'Food and beverage exporters', 'Craft food producers', 'Co-ops and grower groups'
  ] },
  { group: 'Asking for help online', items: [
    'Businesses asking for a web designer', 'Businesses asking for marketing help', 'Businesses asking for social media help',
    'Businesses with no website', 'Businesses with a broken website', 'Businesses with no Google listing', 'New businesses (registered this year)',
    'Businesses for sale (new owners)'
  ] }
]

/* The Auckland region by local board area, then every other region of New Zealand. */
export const AREA_CATALOG: CatalogGroup[] = [
  { group: 'Auckland region', items: ['Auckland region (all)', 'North Shore', 'Hibiscus Coast', 'Rodney', 'West Auckland', 'Central Auckland', 'East Auckland', 'South Auckland', 'Franklin', 'Hauraki Gulf islands'] },
  { group: 'North Shore', items: [
    'Albany', 'Bayswater', 'Beach Haven', 'Belmont', 'Birkdale', 'Birkenhead', 'Campbells Bay', 'Castor Bay', 'Chatswood', 'Cheltenham',
    'Devonport', 'Forrest Hill', 'Glenfield', 'Greenhithe', 'Hauraki', 'Hillcrest', 'Marlborough', 'Milford', 'Narrow Neck', 'Northcote',
    'Northcote Point', 'Pinehill', 'Rosedale', 'Stanley Bay', 'Sunnynook', 'Takapuna', 'Totara Vale', 'Unsworth Heights', 'Wairau Valley', 'Windsor Park'
  ] },
  { group: 'East Coast Bays and Upper Harbour', items: [
    'Browns Bay', 'Mairangi Bay', 'Murrays Bay', 'Rothesay Bay', 'Torbay', 'Long Bay', 'Northcross', 'Oteha', 'Fairview Heights',
    'Schnapper Rock', 'Paremoremo', 'Albany Heights', 'Hobsonville', 'West Harbour', 'Whenuapai', 'Herald Island', 'Scott Point'
  ] },
  { group: 'Hibiscus Coast', items: [
    'Orewa', 'Silverdale', 'Millwater', 'Milldale', 'Red Beach', 'Stanmore Bay', 'Manly', 'Arkles Bay', 'Whangaparāoa', 'Gulf Harbour',
    'Army Bay', 'Tindalls Beach', 'Matakatia', 'Hatfields Beach', 'Waiwera', 'Dairy Flat', 'Stillwater', 'Wainui', 'Ōkura'
  ] },
  { group: 'Rodney', items: [
    'Warkworth', 'Matakana', 'Snells Beach', 'Algies Bay', 'Leigh', 'Omaha', 'Point Wells', 'Sandspit', 'Mahurangi', 'Puhoi',
    'Wellsford', 'Te Hana', 'Kaiwaka', 'Tomarata', 'Mangawhai (Northland border)', 'Helensville', 'Parakai', 'Kaukapakapa', 'Waitoki',
    'Kumeū', 'Huapai', 'Riverhead', 'Waimauku', 'Muriwai', 'Taupaki', 'Coatesville', 'Woodhill', 'South Head', 'Glorit', 'Port Albert'
  ] },
  { group: 'West Auckland', items: [
    'Henderson', 'Henderson Valley', 'Te Atatū Peninsula', 'Te Atatū South', 'Massey', 'Westgate', 'Royal Heights', 'Lincoln',
    'Ranui', 'Swanson', 'Sunnyvale', 'Glen Eden', 'Kelston', 'Glendene', 'New Lynn', 'Avondale', 'Rosebank', 'Green Bay', 'Blockhouse Bay',
    'New Windsor', 'Titirangi', 'Laingholm', 'Waiatarua', 'Oratia', 'Piha', 'Karekare', 'Bethells Beach (Te Henga)', 'Huia', 'Waima', 'Western Heights'
  ] },
  { group: 'Central Auckland', items: [
    'Auckland CBD', 'Wynyard Quarter', 'Westhaven', 'Freemans Bay', 'Ponsonby', 'Herne Bay', 'Grey Lynn', 'Westmere', 'Arch Hill',
    'Kingsland', 'Mt Eden', 'Eden Terrace', 'Newton', 'Grafton', 'Parnell', 'Newmarket', 'Epsom', 'Remuera', 'Ōrākei', 'Mission Bay',
    'Kohimarama', 'St Heliers', 'Glendowie', 'Meadowbank', 'St Johns', 'Ellerslie', 'Greenlane', 'One Tree Hill', 'Royal Oak',
    'Onehunga', 'Te Papapa', 'Penrose', 'Mt Wellington', 'Panmure', 'Glen Innes', 'Point England', 'Stonefields', 'Mt Albert',
    'Mt Roskill', 'Sandringham', 'Balmoral', 'Three Kings', 'Hillsborough', 'Lynfield', 'Waterview', 'Point Chevalier', 'Western Springs'
  ] },
  { group: 'East Auckland', items: [
    'Howick', 'Pakuranga', 'Bucklands Beach', 'Eastern Beach', 'Half Moon Bay', 'Cockle Bay', 'Shelly Park', 'Mellons Bay', 'Sunnyhills',
    'Farm Cove', 'Highland Park', 'Botany Downs', 'Dannemora', 'Flat Bush', 'Ormiston', 'East Tāmaki', 'Burswood', 'Golflands',
    'Somerville', 'Northpark', 'Beachlands', 'Maraetai', 'Whitford', 'Clevedon', 'Kawakawa Bay', 'Ōrere Point'
  ] },
  { group: 'South Auckland', items: [
    'Manukau', 'Ōtara', 'Papatoetoe', 'Middlemore', 'Ōtāhuhu', 'Māngere', 'Māngere Bridge', 'Favona', 'Airport Oaks', 'Wiri', 'Manurewa',
    'Clendon Park', 'Weymouth', 'Wattle Downs', 'Hill Park', 'Homai', 'Takanini', 'Conifer Grove', 'Red Hill', 'Rosehill', 'Papakura',
    'Pahurehure', 'Hingaia', 'Karaka', 'Drury', 'Ardmore', 'Alfriston', 'Brookby'
  ] },
  { group: 'Franklin', items: [
    'Pukekohe', 'Paerata', 'Patumāhoe', 'Waiuku', 'Āwhitu Peninsula', 'Clarks Beach', 'Glenbrook', 'Kingseat', 'Ramarama', 'Bombay',
    'Pukekawa', 'Tuakau (Waikato border)', 'Pōkeno (Waikato border)', 'Waiau Pa', 'Hunua', 'Kaiaua', 'Mauku'
  ] },
  { group: 'Hauraki Gulf islands', items: ['Waiheke Island', 'Oneroa', 'Ostend', 'Onetangi', 'Great Barrier Island (Aotea)', 'Kawau Island', 'Rakino Island'] },
  { group: 'Northland', items: ['Northland (all)', 'Whangārei', 'Kerikeri', 'Paihia', 'Russell', 'Bay of Islands', 'Kaitāia', 'Mangōnui', 'Doubtless Bay', 'Kaikohe', 'Dargaville', 'Mangawhai', 'Ruakākā', 'Waipu', 'Ngunguru', 'Tutukaka', 'Hokianga', 'Ahipara'] },
  { group: 'Waikato', items: ['Waikato (all)', 'Hamilton', 'Hamilton East', 'Rototuna', 'Te Rapa', 'Frankton', 'Cambridge', 'Te Awamutu', 'Huntly', 'Ngāruawāhia', 'Raglan', 'Morrinsville', 'Matamata', 'Te Aroha', 'Paeroa', 'Tokoroa', 'Putāruru', 'Ōtorohanga', 'Te Kūiti', 'Taupō', 'Tūrangi', 'Thames', 'Coromandel', 'Whitianga', 'Tairua', 'Pauanui', 'Whangamatā', 'Waihi', 'Waihi Beach'] },
  { group: 'Bay of Plenty', items: ['Bay of Plenty (all)', 'Tauranga', 'Mount Maunganui', 'Pāpāmoa', 'Bethlehem', 'Ōmokoroa', 'Katikati', 'Te Puke', 'Rotorua', 'Whakatāne', 'Ōhope', 'Kawerau', 'Edgecumbe', 'Ōpōtiki'] },
  { group: 'Gisborne and Hawke\'s Bay', items: ['Gisborne', 'Tolaga Bay', 'Wairoa', "Hawke's Bay (all)", 'Napier', 'Taradale', 'Hastings', 'Havelock North', 'Clive', 'Waipukurau', 'Waipawa'] },
  { group: 'Taranaki', items: ['Taranaki (all)', 'New Plymouth', 'Bell Block', 'Ōakura', 'Waitara', 'Inglewood', 'Stratford', 'Hāwera', 'Ōpunake', 'Eltham'] },
  { group: 'Manawatū-Whanganui', items: ['Manawatū-Whanganui (all)', 'Palmerston North', 'Feilding', 'Levin', 'Foxton', 'Whanganui', 'Marton', 'Taihape', 'Ohakune', 'Raetihi', 'Dannevirke', 'Pahiatua'] },
  { group: 'Wellington region', items: ['Wellington region (all)', 'Wellington CBD', 'Te Aro', 'Thorndon', 'Kelburn', 'Karori', 'Miramar', 'Lyall Bay', 'Island Bay', 'Newtown', 'Johnsonville', 'Ngaio', 'Khandallah', 'Porirua', 'Whitby', 'Lower Hutt', 'Petone', 'Eastbourne', 'Upper Hutt', 'Kāpiti Coast', 'Paraparaumu', 'Waikanae', 'Ōtaki', 'Wairarapa', 'Masterton', 'Carterton', 'Greytown', 'Featherston', 'Martinborough'] },
  { group: 'Nelson, Tasman and Marlborough', items: ['Nelson', 'Stoke', 'Richmond', 'Motueka', 'Māpua', 'Tākaka', 'Golden Bay', 'Kaiteriteri', 'Murchison', 'Marlborough (all)', 'Blenheim', 'Picton', 'Havelock', 'Renwick', 'Marlborough Sounds', 'Kaikōura'] },
  { group: 'West Coast', items: ['West Coast (all)', 'Greymouth', 'Hokitika', 'Westport', 'Reefton', 'Punakaiki', 'Franz Josef', 'Fox Glacier', 'Haast'] },
  { group: 'Canterbury', items: ['Canterbury (all)', 'Christchurch CBD', 'Riccarton', 'Fendalton', 'Merivale', 'Papanui', 'Hornby', 'Sydenham', 'Sumner', 'Lyttelton', 'New Brighton', 'Halswell', 'Rolleston', 'Lincoln (Canterbury)', 'Rangiora', 'Kaiapoi', 'Pegasus', 'Oxford', 'Darfield', 'Akaroa', 'Hanmer Springs', 'Ashburton', 'Methven', 'Geraldine', 'Timaru', 'Temuka', 'Fairlie', 'Lake Tekapo', 'Twizel', 'Waimate'] },
  { group: 'Otago', items: ['Otago (all)', 'Dunedin', 'Mosgiel', 'Port Chalmers', 'St Clair', 'Ōamaru', 'Alexandra', 'Clyde', 'Cromwell', 'Wānaka', 'Queenstown', 'Frankton (Queenstown)', 'Arrowtown', 'Glenorchy', 'Balclutha', 'Roxburgh', 'Ranfurly'] },
  { group: 'Southland', items: ['Southland (all)', 'Invercargill', 'Bluff', 'Gore', 'Winton', 'Te Anau', 'Riverton', 'Stewart Island (Rakiura)'] },
  { group: 'Whole country', items: ['All of New Zealand', 'North Island', 'South Island'] }
]
