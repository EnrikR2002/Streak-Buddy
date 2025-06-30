import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { theme } from '../theme';

export default function AppButton({ title, onPress, style, textStyle, disabled }) {
    return (
        <TouchableOpacity
            activeOpacity={0.7}
            onPress={onPress}
            disabled={disabled}
            style={[
                theme.button,
                disabled && { opacity: 0.6 },
                style,
            ]}
        >
            <Text style={[theme.buttonText, textStyle]}>{title}</Text>
        </TouchableOpacity>
    );
}
