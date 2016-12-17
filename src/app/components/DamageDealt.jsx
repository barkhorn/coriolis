import React from 'react';
import TranslatedComponent from './TranslatedComponent';
import { Ships } from 'coriolis-data/dist';
import ShipSelector from './ShipSelector';
import { nameComparator } from '../utils/SlotFunctions';
import { MountFixed, MountGimballed, MountTurret } from './SvgIcons';

/**
 * Generates an internationalization friendly weapon comparator that will
 * sort by specified property (if provided) then by name/group, class, rating
 * @param  {function} translate       Translation function
 * @param  {function} propComparator  Optional property comparator
 * @param  {boolean} desc             Use descending order
 * @return {function}                 Comparator function for names
 */
export function weaponComparator(translate, propComparator, desc) {
  return (a, b) => {
    if (!desc) {  // Flip A and B if ascending order
      let t = a;
      a = b;
      b = t;
    }

    // If a property comparator is provided use it first
    let diff = propComparator ? propComparator(a, b) : nameComparator(translate, a, b);

    if (diff) {
      return diff;
    }

    // Property matches so sort by name / group, then class, rating
    if (a.name === b.name && a.grp === b.grp) {
      if(a.class == b.class) {
        return a.rating > b.rating ? 1 : -1;
      }
      return a.class - b.class;
    }

    return nameComparator(translate, a, b);
  };
}

/**
 * Damage against a selected ship
 */
export default class DamageDealt extends TranslatedComponent {
  static PropTypes = {
    ship: React.PropTypes.object.isRequired,
    code: React.PropTypes.string.isRequired
  };

  static DEFAULT_AGAINST = Ships['anaconda'];

  /**
   * Constructor
   * @param  {Object} props   React Component properties
   */
  constructor(props) {
    super(props);

    this._sort = this._sort.bind(this);
    this._onShipChange = this._onShipChange.bind(this);

    this.state = {
      predicate: 'n',
      desc: true,
      against: DamageDealt.DEFAULT_AGAINST
    };
  }

  /**
   * Set the initial weapons state
   */
  componentWillMount() {
    const weapons = this._calcWeapons(this.props.ship, this.state.against);
    this.setState({ weapons: weapons });
  }

  /**
   * Set the updated weapons state
   */
  componentWillReceiveProps(nextProps, nextContext) {
    const weapons = this._calcWeapons(this.props.ship, this.state.against);
    this.setState({ weapons: weapons });
    return true;
  }

  _calcWeapons(ship, against) {
    // Create a list of the ship's weapons and include required stats - this is so that we muck around with re-ordering and the like on the fly
    let weapons = [];

    for (let i = 0; i < ship.hardpoints.length; i++) {
      if (ship.hardpoints[i].m) {
        const m = ship.hardpoints[i].m;
        const classRating = `${m.class}${m.rating}${m.missile ? '/' + m.missile : ''}`;
        const effectiveness = m.getPiercing() >= against.properties.hardness ? 1 : m.getPiercing() / against.properties.hardness;
        const effectiveDps = m.getDps() * effectiveness;
        const effectiveSDps = m.getClip() ?  (m.getClip() * m.getDps() / m.getRoF()) / ((m.getClip() / m.getRoF()) + m.getReload()) * effectiveness : effectiveDps;

        weapons.push({id: i,
                      mount: m.mount,
                      name: m.name || m.grp,
                      classRating: classRating,
                      effectiveDps: effectiveDps,
                      effectiveSDps: effectiveSDps,
                      effectiveness: effectiveness});
      }
    }

    return weapons;
  }

  /**
   * Triggered when the ship changes
   * @param {string} s the new ship ID
   */
  _onShipChange(s) {
    const against = Ships[s];
    const weapons = this._calcWeapons(this.props.ship, against);
    // This is not the correct 'this'
console.log('1) State against is' + this.state.against.properties.name);
    this.setState({ against: against, weapons: weapons });
console.log('2) State against is' + this.state.against.properties.name);
  }

  /**
   * Set the sort order and sort
   * @param  {string} predicate Sort predicate
   */
  _sortOrder(predicate) {
    let desc = this.state.desc;

    if (predicate == this.state.predicate) {
      desc = !desc;
    } else {
      desc = true;
    }

    this._sort(this.props.ship, predicate, desc);
    this.setState({ predicate, desc });
  }

  /**
   * Sorts the weapon list
   * @param  {Ship} ship          Ship instance
   * @param  {string} predicate   Sort predicate
   * @param  {Boolean} desc       Sort order descending
   */
  _sort(ship, predicate, desc) {
    let comp = weaponComparator.bind(null, this.context.language.translate);

    switch (predicate) {
      case 'n': comp = comp(null, desc); break;
      case 'edps': comp = comp((a, b) => a.effectiveDps - b.effectiveDps, desc); break;
      case 'esdps': comp = comp((a, b) => a.effectiveSDps - b.effectiveSDps, desc); break;
      case 'e': comp = comp((a, b) => a.effectiveness - b.effectiveness, desc); break;
    }

    this.state.weapons.sort(comp);
  }

  /**
   * Render individual rows for hardpoints
   * @param  {Function} translate   Translate function
   * @param  {Object}   formats     Localised formats map
   * @return {array}                The individual rows
   *
   */
  _renderRows(translate, formats) {
    const { termtip, tooltip } = this.context;

    let rows = [];

    if (this.state.weapons) {
      for (let i = 0; i < this.state.weapons.length; i++) {
        const weapon = this.state.weapons[i];

        rows.push(<tr key={weapon.id}>
                    <td className='ri'>
                      {weapon.mount == 'F' ? <span onMouseOver={termtip.bind(null, 'fixed')} onMouseOut={tooltip.bind(null, null)}><MountFixed className='icon'/></span> : null}
                      {weapon.mount == 'G' ? <span onMouseOver={termtip.bind(null, 'gimballed')} onMouseOut={tooltip.bind(null, null)}><MountGimballed /></span> : null}
                      {weapon.mount == 'T' ? <span onMouseOver={termtip.bind(null, 'turreted')} onMouseOut={tooltip.bind(null, null)}><MountTurret /></span> : null}
                      {weapon.classRating} {translate(weapon.name)}
                    </td>
                    <td className='ri'>{formats.round1(weapon.effectiveDps)}</td>
                    <td className='ri'>{formats.round1(weapon.effectiveSDps)}</td>
                    <td className='ri'>{formats.pct(weapon.effectiveness)}</td>
                  </tr>);
      }
    }

    return rows;
  }

  /**
   * Render damage dealt
   * @return {React.Component} contents
   */
  render() {
    const { language, tooltip, termtip } = this.context;
    const { formats, translate } = language;

    const sortOrder = this._sortOrder;

    return (
      <span>
        <h1>{translate('damage dealt against')}</h1>
        <ShipSelector initial={this.state.against} currentMenu={this.props.currentMenu} onChange={this._onShipChange} />
        <table className='summary' style={{ width: '100%' }}>
          <thead>
          <tr className='main'>
            <td className='sortable' onClick={sortOrder.bind(this, 'n')}>{translate('weapon')}</td>
            <td className='sortable' onClick={sortOrder.bind(this, 'edps')}>{translate('effective dps')}</td>
            <td className='sortable' onClick={sortOrder.bind(this, 'esdps')}>{translate('effective sdps')}</td>
            <td className='sortable' onClick={sortOrder.bind(this, 'e')}>{translate('effectiveness')}</td>
          </tr>
          </thead>
          <tbody>
            {this._renderRows(translate, formats)}
          </tbody>
        </table>
      </span>
    );
  }
}
