import React from 'react'
import { useTranslation } from 'react-i18next'

const DONOR_STEPS = [
  {
    titleKey: 'logisticsGuide.donor.step1.title',
    titleDefault: 'Post food',
    descKey: 'logisticsGuide.donor.step1.desc',
    descDefault: 'Create a listing with quantity, expiry and pickup notes.',
  },
  {
    titleKey: 'logisticsGuide.donor.step2.title',
    titleDefault: 'Review claims',
    descKey: 'logisticsGuide.donor.step2.desc',
    descDefault: 'Choose an organisation and confirm availability.',
  },
  {
    titleKey: 'logisticsGuide.donor.step3.title',
    titleDefault: 'Coordinate pickup',
    descKey: 'logisticsGuide.donor.step3.desc',
    descDefault: 'Share pickup time window and contact details.',
  },
  {
    titleKey: 'logisticsGuide.donor.step4.title',
    titleDefault: 'Mark complete',
    descKey: 'logisticsGuide.donor.step4.desc',
    descDefault: 'Finish the handover and close the listing.',
  },
]

const ORG_STEPS = [
  {
    titleKey: 'logisticsGuide.org.step1.title',
    titleDefault: 'Find listing',
    descKey: 'logisticsGuide.org.step1.desc',
    descDefault: 'Filter food listings by category, postcode and urgency.',
  },
  {
    titleKey: 'logisticsGuide.org.step2.title',
    titleDefault: 'Claim item',
    descKey: 'logisticsGuide.org.step2.desc',
    descDefault: 'Submit a claim request for your organisation.',
  },
  {
    titleKey: 'logisticsGuide.org.step3.title',
    titleDefault: 'Confirm logistics',
    descKey: 'logisticsGuide.org.step3.desc',
    descDefault: 'Confirm pickup time, location and contact person.',
  },
  {
    titleKey: 'logisticsGuide.org.step4.title',
    titleDefault: 'Collect food',
    descKey: 'logisticsGuide.org.step4.desc',
    descDefault: 'Complete pickup and update status.',
  },
]

const LogisticsGuideCard = ({ role = 'donor' }) => {
  const { t } = useTranslation()
  const steps = role === 'org' ? ORG_STEPS : DONOR_STEPS

  return (
    <section className={`logistics-guide logistics-guide--${role}`} aria-label={t('logisticsGuide.ariaLabel', 'Pickup workflow guide')}>
      <div className="logistics-guide__head">
        <p className="logistics-guide__eyebrow">{t('logisticsGuide.eyebrow', 'How pickup works')}</p>
        <h3>{t('logisticsGuide.title', 'From listing to collection in 4 steps')}</h3>
      </div>

      <ol className="logistics-guide__steps">
        {steps.map((step, index) => (
          <li key={step.titleKey} className="logistics-guide__step">
            <span className="logistics-guide__index">{index + 1}</span>
            <div className="logistics-guide__copy">
              <strong>{t(step.titleKey, step.titleDefault)}</strong>
              <p>{t(step.descKey, step.descDefault)}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

export default LogisticsGuideCard
