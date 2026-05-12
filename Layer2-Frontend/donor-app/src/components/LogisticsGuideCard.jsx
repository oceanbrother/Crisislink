import React from 'react'
import { useTranslation } from 'react-i18next'

const DONOR_STEPS = [
  {
    titleKey: 'logisticsGuide.donor.step1.title',
    titleDefault: 'Post food',
    descKey: 'logisticsGuide.donor.step1.desc',
    descDefault: 'Add photo, expiry date, allergens, storage, and pickup window.',
  },
  {
    titleKey: 'logisticsGuide.donor.step2.title',
    titleDefault: 'Review claims',
    descKey: 'logisticsGuide.donor.step2.desc',
    descDefault: 'Review claim requests and confirm availability.',
    statusKey: 'logisticsGuide.donor.step2.status',
    statusDefault: 'Status: Available → Claimed',
  },
  {
    titleKey: 'logisticsGuide.donor.step3.title',
    titleDefault: 'Coordinate pickup',
    descKey: 'logisticsGuide.donor.step3.desc',
    descDefault: 'Confirm pickup window and collection notes in-app.',
    statusKey: 'logisticsGuide.donor.step3.status',
    statusDefault: 'Status: Claimed',
  },
  {
    titleKey: 'logisticsGuide.donor.step4.title',
    titleDefault: 'Confirm collection',
    descKey: 'logisticsGuide.donor.step4.desc',
    descDefault: 'Mark the listing as collected after pickup completes.',
    statusKey: 'logisticsGuide.donor.step4.status',
    statusDefault: 'Status: Collected',
  },
]

const ORG_STEPS = [
  {
    titleKey: 'logisticsGuide.org.step1.title',
    titleDefault: 'Find available food',
    descKey: 'logisticsGuide.org.step1.desc',
    descDefault: 'Browse nearby listings and check expiry, storage, and allergen information.',
  },
  {
    titleKey: 'logisticsGuide.org.step2.title',
    titleDefault: 'Claim item',
    descKey: 'logisticsGuide.org.step2.desc',
    descDefault: 'Reserve suitable food for your organisation.',
    statusKey: 'logisticsGuide.org.step2.status',
    statusDefault: 'Status: Available → Claimed',
  },
  {
    titleKey: 'logisticsGuide.org.step3.title',
    titleDefault: 'Arrange pickup',
    descKey: 'logisticsGuide.org.step3.desc',
    descDefault: 'Check pickup window and collection notes.',
    statusKey: 'logisticsGuide.org.step3.status',
    statusDefault: 'Status: Claimed',
  },
  {
    titleKey: 'logisticsGuide.org.step4.title',
    titleDefault: 'Confirm collected',
    descKey: 'logisticsGuide.org.step4.desc',
    descDefault: 'Mark the item as collected after pickup.',
    statusKey: 'logisticsGuide.org.step4.status',
    statusDefault: 'Status: Collected',
  },
]

const LogisticsGuideCard = ({ role = 'donor' }) => {
  const { t } = useTranslation()
  const steps = role === 'org' ? ORG_STEPS : DONOR_STEPS
  const eyebrowKey = role === 'org' ? 'logisticsGuide.orgEyebrow' : 'logisticsGuide.eyebrow'
  const titleKey = role === 'org' ? 'logisticsGuide.orgTitle' : 'logisticsGuide.title'

  return (
    <section className={`logistics-guide logistics-guide--${role}`} aria-label={t('logisticsGuide.ariaLabel', 'Pickup workflow guide')}>
      <div className="logistics-guide__head">
        <p className="logistics-guide__eyebrow">{t(eyebrowKey, 'How it works')}</p>
        <h3>{t(titleKey, 'Track each donation from listing to confirmed collection.')}</h3>
      </div>

      <ol className="logistics-guide__steps">
        {steps.map((step, index) => (
          <li key={step.titleKey} className="logistics-guide__step">
            <span className="logistics-guide__index">{index + 1}</span>
            <div className="logistics-guide__copy">
              <strong>{t(step.titleKey, step.titleDefault)}</strong>
              <p>{t(step.descKey, step.descDefault)}</p>
              {step.statusKey ? (
                <span className="logistics-guide__status">
                  {t(step.statusKey, step.statusDefault)}
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

export default LogisticsGuideCard
