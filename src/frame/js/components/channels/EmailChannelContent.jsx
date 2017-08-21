import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

export class EmailChannelContentComponent extends Component {
    static propTypes = {
        linkColor: PropTypes.string,
        fromAddress: PropTypes.string,
        genericAddress: PropTypes.string.isRequired
    };

    render() {
        const {linkColor, fromAddress, genericAddress} = this.props;
        const email = fromAddress || genericAddress;

        const styleOverride = linkColor ? {
            color: `#${linkColor}`
        } : null;

        return <a href={ `mailto:${email}` }
                  style={ styleOverride }
                  target='_blank'>
                   { email }
               </a>;
    }
}

export default connect(({config}) => {
    return {
        linkColor: config.style.linkColor
    };
})(EmailChannelContentComponent);
