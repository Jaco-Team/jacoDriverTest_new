import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'

import { getPasswordRequirements } from '@/shared/lib/passwordRequirements'

function RequirementCheckIcon(): React.JSX.Element {
  return (
    <Svg width={12} height={12} viewBox="0 0 18 18" accessibilityElementsHidden>
      <Path
        d="M4.8 9.3C5.8 10.1 6.7 11.1 7.5 12.2C9.3 9.5 11.3 7.2 13.3 5.7"
        fill="none"
        stroke="#2E7D32"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.55}
      />
    </Svg>
  )
}

interface PasswordRequirementsProps {
  password: string
}

export function PasswordRequirements({
  password,
}: PasswordRequirementsProps): React.JSX.Element {
  const requirements = getPasswordRequirements(password)

  return (
    <View style={styles.container} testID="reset-password-requirements">
      <Text style={styles.title}>Пароль должен содержать:</Text>

      <View style={styles.list}>
        {requirements.map((requirement) => (
          <View key={requirement.label} style={styles.item}>
            <View
              style={[styles.mark, requirement.met && styles.markCompleted]}
            >
              {requirement.met ? <RequirementCheckIcon /> : null}
            </View>
            <Text
              style={[
                styles.label,
                requirement.met && styles.labelCompleted,
              ]}
            >
              {requirement.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginTop: 2,
  },
  title: {
    marginBottom: 8,
    color: 'rgba(83, 59, 66, 0.58)',
    fontFamily: 'Roboto-Medium',
    fontSize: 12,
    lineHeight: 16,
  },
  list: {
    gap: 8,
  },
  item: {
    minHeight: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mark: {
    width: 18,
    height: 18,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
  },
  markCompleted: {
    borderColor: '#2E7D32',
    backgroundColor: '#E8F5E9',
  },
  label: {
    flexShrink: 1,
    color: 'rgba(83, 59, 66, 0.58)',
    fontFamily: 'Roboto-Medium',
    fontSize: 12,
    lineHeight: 17,
  },
  labelCompleted: {
    color: '#2E7D32',
  },
})
