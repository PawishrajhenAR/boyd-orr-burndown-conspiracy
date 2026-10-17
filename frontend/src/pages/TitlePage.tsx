import { useNavigate } from 'react-router-dom'
import { Button, Character } from '../components/game/GameKit'
import { useCaseStore } from '../store/useCaseStore'

export default function TitlePage() {
  const go = useNavigate()
  const setJudge = useCaseStore((s) => s.setJudgeMode)

  return (
    <div className="title-page">
      <div>
        <p className="eyebrow">Glasgow University Security Division</p>
        <h1>
          CASE FILE #1105:
          <br />
          THE BOYD ORR
          <br />
          FIREWORK PLOT
        </h1>
        <p>One day of swipes. Six conspirators. One clean mastermind.</p>
        <div className="action-row">
          <Button onClick={() => go('/briefing')}>Start case</Button>
          <Button
            onClick={() => {
              setJudge(true)
              go('/board')
            }}
          >
            Judge mode
          </Button>
        </div>
      </div>
      <div className="title-ember">
        <Character variant="ember" />
        <span>Inspector Ember</span>
      </div>
    </div>
  )
}
